import { useQueryClient } from "@tanstack/react-query"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { TestRecordsService } from "@/client"
import { getMessages, sendMessageStream } from "@/services/difyApi"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
  isPaused?: boolean
  userQuery?: string
  versions?: string[]
  currentVersion?: number
}

const CACHE_TTL = 30 * 60 * 1000 // 30 分钟

// ── 全局消息缓存（sessionStorage，按 userId + sessionId 维度）────────────
const TEST_CACHE_PREFIX = "emomind_test_messages"

interface TestCacheData {
  messages: ChatMessage[]
  isStreaming: boolean
  wasStopped?: boolean
  timestamp: number
}

function getTestCacheKey(userId: string, sessionId: string) {
  return `${TEST_CACHE_PREFIX}_${userId}_${sessionId || "new"}`
}

function getTestCache(userId: string, sessionId: string): TestCacheData | null {
  try {
    const data = sessionStorage.getItem(getTestCacheKey(userId, sessionId))
    if (data) {
      const parsed = JSON.parse(data) as TestCacheData
      // 缓存有效期 30 分钟
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return null
}

function setTestCache(userId: string, sessionId: string, data: TestCacheData) {
  try {
    sessionStorage.setItem(
      getTestCacheKey(userId, sessionId),
      JSON.stringify(data),
    )
  } catch {
    // ignore
  }
}

function clearTestCache(userId: string, sessionId: string) {
  sessionStorage.removeItem(getTestCacheKey(userId, sessionId))
}

// ── 模块级流式状态注册表 ─────────────────────────────────────────────────────
interface StreamRegistryEntry {
  abortController: AbortController
  isStreaming: boolean
  messages: ChatMessage[]
}

const streamRegistry = new Map<string, StreamRegistryEntry>()

function getStreamKey(userId: string, sessionId: string) {
  return `test::${userId}::${sessionId || ""}`
}

function registerStream(
  userId: string,
  sessionId: string,
  entry: StreamRegistryEntry,
) {
  streamRegistry.set(getStreamKey(userId, sessionId), entry)
}

function unregisterStream(userId: string, sessionId: string) {
  streamRegistry.delete(getStreamKey(userId, sessionId))
}

function getStreamEntry(
  userId: string,
  sessionId: string,
): StreamRegistryEntry | undefined {
  return streamRegistry.get(getStreamKey(userId, sessionId))
}

function updateStreamMessages(
  userId: string,
  sessionId: string,
  messages: ChatMessage[],
) {
  const entry = streamRegistry.get(getStreamKey(userId, sessionId))
  if (entry) {
    entry.messages = messages
  }
}

function setStreamNotStreaming(userId: string, sessionId: string) {
  const entry = streamRegistry.get(getStreamKey(userId, sessionId))
  if (entry) {
    entry.isStreaming = false
  }
}

export interface TestQuestion {
  id: string
  text: string
  type: string
  options: string[]
  scores: number[]
}

export interface TestData {
  test_id: string
  title: string
  dimension: string
  description: string
  total_questions: number
  questions: TestQuestion[]
  scoring: {
    total_max: number
    ranges: { min: number; max: number; label: string; description: string }[]
  }
}

export type SubmissionStatus = "idle" | "submitting" | "analyzing" | "done"

export function usePsychologicalTest(
  userId: string,
  sessionId: string,
  setActiveConvId: (id: string) => void,
  loadConversations: () => void,
  onSessionCreated?: (conversationId: string) => void,
) {
  const queryClient = useQueryClient()

  // 聊天状态
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)

  // 答题状态
  const [activeTest, setActiveTest] = useState<TestData | null>(null)
  const [testAnswers, setTestAnswers] = useState<
    Record<string, { answer: number; score: number }>
  >({})
  const [submissionStatus, setSubmissionStatus] =
    useState<SubmissionStatus>("idle")

  // workflow 运行状态
  const [workflowRunning, setWorkflowRunning] = useState(false)

  // UI refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const loadingConvIdRef = useRef<string | null>(null)
  const stoppedRef = useRef(false)
  const justResolvedRef = useRef<string | null>(null)
  const notFoundIdsRef = useRef<Set<string>>(new Set())

  // 用 ref 存储外部回调，防止 loadMessages 因依赖变化而重建导致 useEffect 竞态
  const setActiveConvIdRef = useRef(setActiveConvId)
  setActiveConvIdRef.current = setActiveConvId
  const loadConversationsRef = useRef(loadConversations)
  loadConversationsRef.current = loadConversations
  const onSessionCreatedRef = useRef(onSessionCreated)
  onSessionCreatedRef.current = onSessionCreated

  // 挂载状态跟踪
  const isMountedRef = useRef(true)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages
  const isStreamingRef = useRef(isStreaming)
  isStreamingRef.current = isStreaming

  // ── 会话切换同步处理 ──────────────────────────────────────────────────────
  const prevSessionIdRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (sessionId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = sessionId

      if (sessionId) {
        const registryEntry = getStreamEntry(userId, sessionId)
        if (registryEntry) {
          setMessages(registryEntry.messages)
          setIsStreaming(registryEntry.isStreaming)
          if (registryEntry.isStreaming) {
            abortControllerRef.current = registryEntry.abortController
          }
          return
        }

        const cached = getTestCache(userId, sessionId)
        if (cached && cached.messages.length > 0) {
          setMessages(cached.messages)
          setIsStreaming(cached.isStreaming)
          return
        }
      } else {
        // 基础路由（sessionId=""）：只恢复正在进行的流，否则清空
        const registryEntry = getStreamEntry(userId, "")
        if (registryEntry?.isStreaming) {
          setMessages(registryEntry.messages)
          setIsStreaming(true)
          abortControllerRef.current = registryEntry.abortController
          return
        }
      }

      setMessages([])
      setIsStreaming(false)
    }
  }, [sessionId, userId])

  // ── 加载历史消息 ────────────────────────────────────────────────────────────
  const loadMessages = useCallback(
    async (convId: string) => {
      // 身份未解析前不请求 API，避免 "anonymous" 导致假 404
      // userId 变为真实值后 useEffect 会自动重试
      if (userId === "anonymous") return

      loadingConvIdRef.current = convId
      setIsStreaming(false)
      sessionStorage.removeItem("test_streaming")
      // 注意：不在这里清缓存和消息，避免 API 请求期间页面闪空白
      // API 返回后再整体替换
      try {
        const result = await getMessages(userId, convId, {
          apiKeyName: "test",
        })
        if (loadingConvIdRef.current !== convId) return
        // API 成功后才清旧缓存并写入新数据
        clearTestCache(userId, convId)
        const chatMsgs: ChatMessage[] = []
        const sorted = [...result.data].sort(
          (a, b) => a.created_at - b.created_at,
        )
        // 保留现有 assistant 消息的前端元数据（versions / currentVersion 等），避免 API 刷新后丢失
        const existingAssistants = messagesRef.current.filter(
          (m) => m.role === "assistant",
        )
        let assistantIdx = 0
        for (const msg of sorted) {
          if (msg.query && typeof msg.query === "string") {
            if (!msg.query.startsWith("RESULT_JSON::")) {
              chatMsgs.push({ role: "user", content: msg.query })
            }
          }
          if (msg.answer && typeof msg.answer === "string") {
            const testJsonIdx = msg.answer.indexOf("TEST_JSON::")
            let content: string | null = null
            if (testJsonIdx !== -1) {
              const prefixText = msg.answer.slice(0, testJsonIdx).trim()
              if (prefixText) content = prefixText
            } else if (!msg.answer.startsWith("RESULT_JSON::")) {
              content = msg.answer
            }
            if (content) {
              const existing = existingAssistants[assistantIdx]
              chatMsgs.push({
                role: "assistant",
                content,
                ...(existing
                  ? {
                      versions: existing.versions,
                      currentVersion: existing.currentVersion,
                      isPaused: existing.isPaused,
                      userQuery: existing.userQuery,
                    }
                  : {}),
              })
              assistantIdx++
            }
          }
        }
        setMessages(chatMsgs)
      } catch (error) {
        if (loadingConvIdRef.current !== convId) return
        if (error instanceof Error && error.message.includes("404")) {
          notFoundIdsRef.current.add(`${userId}:${convId}`)
          setActiveConvIdRef.current("")
        }
        setMessages([])
      }
    },
    [userId],
  )

  useEffect(() => {
    let cancelled = false
    let pollingTimer: ReturnType<typeof setInterval> | null = null
    const run = async () => {
      if (justResolvedRef.current === sessionId) {
        justResolvedRef.current = null
        return
      }

      if (sessionId && notFoundIdsRef.current.has(`${userId}:${sessionId}`)) {
        setMessages([])
        setIsStreaming(false)
        setActiveConvId("")
        return
      }

      if (sessionId) {
        // ── 有 sessionId：优先从注册表/缓存恢复，否则从 API 加载 ────────
        const registryEntry = getStreamEntry(userId, sessionId)
        if (registryEntry?.isStreaming) {
          setMessages(registryEntry.messages)
          setIsStreaming(true)
          abortControllerRef.current = registryEntry.abortController

          pollingTimer = setInterval(() => {
            const entry = getStreamEntry(userId, sessionId)
            if (!entry || !entry.isStreaming) {
              if (pollingTimer) clearInterval(pollingTimer)
              pollingTimer = null
              setIsStreaming(false)
              abortControllerRef.current = null
              if (entry && entry.messages.length > 0) {
                setMessages(entry.messages)
              }
              unregisterStream(userId, sessionId)
              // 关键修复：检查是否为用户主动暂停，若是则不调用 loadMessages
              const lastAssistant = entry?.messages
                ?.slice()
                .reverse()
                .find((m) => m.role === "assistant")
              if (!lastAssistant?.isPaused) {
                loadMessages(sessionId)
              }
            } else {
              setMessages(entry.messages)
            }
          }, 300)
          return
        }

        const completedEntry = getStreamEntry(userId, sessionId)
        if (
          completedEntry &&
          !completedEntry.isStreaming &&
          completedEntry.messages.length > 0
        ) {
          setMessages(completedEntry.messages)
          setIsStreaming(false)
          abortControllerRef.current = null
          unregisterStream(userId, sessionId)
          return
        }

        const cached = getTestCache(userId, sessionId)
        if (cached && cached.messages.length > 0) {
          setMessages(cached.messages)
          setIsStreaming(cached.isStreaming)
          if (cached.isStreaming) {
            pollingTimer = setInterval(() => {
              const entry = getStreamEntry(userId, sessionId)
              if (!entry || !entry.isStreaming) {
                if (pollingTimer) clearInterval(pollingTimer)
                pollingTimer = null
                setIsStreaming(false)
                // 关键修复：检查是否为用户主动暂停，若是则不调用 loadMessages
                const lastAssistant = entry?.messages
                  ?.slice()
                  .reverse()
                  .find((m) => m.role === "assistant")
                if (!lastAssistant?.isPaused) {
                  loadMessages(sessionId)
                }
              } else if (entry.messages.length > 0) {
                setMessages(entry.messages)
              }
            }, 500)
            return
          }
          if (cached.wasStopped) {
            setTestCache(userId, sessionId, {
              ...cached,
              wasStopped: false,
            })
            return
          }
          return
        }

        await loadMessages(sessionId)
        if (cancelled) return
        // 如果 loadMessages 因 anonymous 被跳过，不再执行后续逻辑
        if (userId === "anonymous") return
        if (sessionStorage.getItem("test_streaming") === "true") {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last?.isStreaming) return prev
            return [
              ...prev,
              { role: "assistant", content: "", isStreaming: true },
            ]
          })
        }
      } else {
        // ── 无 sessionId（基础路由 / 新对话模式）────────────────────────
        // 基础路由始终显示模板页面，只恢复正在进行的流式请求
        const registryEntry = getStreamEntry(userId, "")
        if (registryEntry?.isStreaming) {
          setMessages(registryEntry.messages)
          setIsStreaming(true)
          abortControllerRef.current = registryEntry.abortController

          pollingTimer = setInterval(() => {
            const entry = getStreamEntry(userId, "")
            if (!entry || !entry.isStreaming) {
              if (pollingTimer) clearInterval(pollingTimer)
              pollingTimer = null
              setIsStreaming(false)
              abortControllerRef.current = null
              if (entry && entry.messages.length > 0) {
                setMessages(entry.messages)
              }
            } else {
              setMessages(entry.messages)
            }
          }, 300)
          return
        }

        // 不恢复已完成的流或缓存，基础路由显示空状态
        setMessages([])
        setIsStreaming(false)
        setActiveTest(null)
        setTestAnswers({})
      }
    }
    run()
    return () => {
      cancelled = true
      if (pollingTimer) clearInterval(pollingTimer)
    }
  }, [sessionId, loadMessages, userId, setActiveConvId])

  // 挂载状态跟踪 + 组件卸载时保存缓存
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (messagesRef.current.length > 0) {
        setTestCache(userId, sessionIdRef.current, {
          messages: messagesRef.current,
          isStreaming: isStreamingRef.current,
          timestamp: Date.now(),
        })
      }
    }
  }, [userId])

  // 页面重新可见时刷新消息
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && sessionId) {
        const registryEntry = getStreamEntry(userId, sessionId)
        if (registryEntry?.isStreaming) {
          setMessages(registryEntry.messages)
          abortControllerRef.current = registryEntry.abortController
          return
        }
        // 关键修复：如果有消息处于用户主动暂停状态，不要调用 loadMessages
        const hasPausedMessage = messagesRef.current.some(
          (m) => m.role === "assistant" && m.isPaused,
        )
        if (hasPausedMessage) {
          return
        }
        if (isStreaming) {
          setIsStreaming(false)
          abortControllerRef.current = null
        }
        loadMessages(sessionId)
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [sessionId, loadMessages, userId, isStreaming])

  // ── 解析 TEST_JSON ──────────────────────────────────────────────────────────
  const tryParseTestJson = (
    content: string | undefined | null,
  ): TestData | null => {
    if (content == null || typeof content !== "string") {
      return null
    }
    const PREFIX = "TEST_JSON::"
    const idx = content.indexOf(PREFIX)
    if (idx === -1) return null
    try {
      const raw = content.slice(idx + PREFIX.length).trim()
      return JSON.parse(raw) as TestData
    } catch {
      return null
    }
  }

  // ── 辅助函数：同时更新 ref、注册表和缓存 ────────────────────────────────────
  const updateMessagesAndCache = (
    updatedMessages: ChatMessage[],
    streaming: boolean,
  ) => {
    messagesRef.current = updatedMessages
    const sid = sessionIdRef.current || ""
    updateStreamMessages(userId, sid, updatedMessages)
    if (!streaming) {
      setStreamNotStreaming(userId, sid)
    }
    setTestCache(userId, sid, {
      messages: updatedMessages,
      isStreaming: streaming,
      timestamp: Date.now(),
    })
  }

  // ── 普通消息发送 ────────────────────────────────────────────────────────────
  const handleSend = async (overrideText?: string, silent?: boolean) => {
    const text = (overrideText !== undefined ? overrideText : inputText).trim()
    if (!text) return
    if (isStreaming) return

    stoppedRef.current = false

    setIsStreaming(true)
    sessionStorage.setItem("test_streaming", "true")
    setWorkflowRunning(false)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const userMsg: ChatMessage = { role: "user", content: text }
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      isStreaming: true,
      userQuery: text,
    }
    let nextMessages: ChatMessage[]
    if (!silent) {
      nextMessages = [...messagesRef.current, userMsg, assistantMsg]
      setMessages((prev) => [...prev, userMsg])
      setInputText("")
    } else {
      nextMessages = [...messagesRef.current, assistantMsg]
    }
    messagesRef.current = nextMessages

    // 立即保存到缓存
    setTestCache(userId, sessionId || "", {
      messages: nextMessages,
      isStreaming: true,
      timestamp: Date.now(),
    })

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", isStreaming: true },
    ])

    // 在模块级注册表中注册此流
    const cacheSessionId = sessionId || ""
    registerStream(userId, cacheSessionId, {
      abortController,
      isStreaming: true,
      messages: nextMessages,
    })

    let accumulated = ""
    let streamHandledEnd = false
    let detectedTest: TestData | null = null

    try {
      await sendMessageStream(
        text,
        userId,
        {
          onMessage: (answer) => {
            if (stoppedRef.current) return
            accumulated += answer
            if (!detectedTest && accumulated.includes("TEST_JSON::")) {
              const lastMsg =
                messagesRef.current[messagesRef.current.length - 1]
              if (lastMsg?.isStreaming) {
                const updatedMessages = [
                  ...messagesRef.current.slice(0, -1),
                  { ...lastMsg, content: "正在生成测评题目..." },
                ]
                updateMessagesAndCache(updatedMessages, true)
              }
              setMessages((prev) => {
                const newMsgs = [...prev]
                const last = newMsgs[newMsgs.length - 1]
                if (last?.isStreaming) {
                  newMsgs[newMsgs.length - 1] = {
                    ...last,
                    content: "正在生成测评题目...",
                  }
                }
                return newMsgs
              })
            } else if (!accumulated.includes("TEST_JSON::")) {
              const lastMsg =
                messagesRef.current[messagesRef.current.length - 1]
              if (lastMsg?.isStreaming) {
                const updatedMessages = [
                  ...messagesRef.current.slice(0, -1),
                  { ...lastMsg, content: accumulated },
                ]
                updateMessagesAndCache(updatedMessages, true)
              }
              setMessages((prev) => {
                const newMsgs = [...prev]
                const last = newMsgs[newMsgs.length - 1]
                if (last?.isStreaming) {
                  newMsgs[newMsgs.length - 1] = {
                    ...last,
                    content: accumulated,
                  }
                }
                return newMsgs
              })
            }
          },
          onMessageEnd: (_messageId, conversationId) => {
            streamHandledEnd = true
            isStreamingRef.current = false
            setIsStreaming(false)
            sessionStorage.removeItem("test_streaming")
            abortControllerRef.current = null
            setWorkflowRunning(false)

            const parsed = tryParseTestJson(accumulated)
            if (parsed) {
              detectedTest = parsed
              const prefixText = accumulated
                .slice(0, accumulated.indexOf("TEST_JSON::"))
                .trim()
              const displayContent = prefixText
                ? `${prefixText}\n\n已为您准备好《${parsed.title}》，请在下方完成作答。`
                : `已为您准备好《${parsed.title}》，请在下方完成作答。`
              const lastMsg =
                messagesRef.current[messagesRef.current.length - 1]
              if (
                lastMsg?.isStreaming ||
                lastMsg?.content === "正在生成测评题目..."
              ) {
                const updatedMessages: ChatMessage[] = [
                  ...messagesRef.current.slice(0, -1),
                  {
                    role: "assistant" as const,
                    content: displayContent,
                    isStreaming: false,
                  },
                ]
                updateMessagesAndCache(updatedMessages, false)
              }
              setMessages((prev) => {
                const newMsgs = [...prev]
                const last = newMsgs[newMsgs.length - 1]
                if (
                  last?.isStreaming ||
                  last?.content === "正在生成测评题目..."
                ) {
                  newMsgs[newMsgs.length - 1] = {
                    role: "assistant",
                    content: displayContent,
                    isStreaming: false,
                  }
                }
                return newMsgs
              })
              setActiveTest(parsed)
              setTestAnswers({})
            } else {
              const lastMsg =
                messagesRef.current[messagesRef.current.length - 1]
              if (lastMsg?.isStreaming) {
                const updatedMessages = [
                  ...messagesRef.current.slice(0, -1),
                  { ...lastMsg, isStreaming: false },
                ]
                updateMessagesAndCache(updatedMessages, false)
              }
              setMessages((prev) => {
                const newMsgs = [...prev]
                const last = newMsgs[newMsgs.length - 1]
                if (last?.isStreaming) {
                  newMsgs[newMsgs.length - 1] = { ...last, isStreaming: false }
                }
                return newMsgs
              })
            }

            // 新会话创建：API 返回了真实 conversationId
            if (conversationId && !sessionIdRef.current) {
              const oldCache = getTestCache(userId, "")
              if (oldCache) {
                clearTestCache(userId, "")
              }
              unregisterStream(userId, "")
              registerStream(userId, conversationId, {
                abortController,
                isStreaming: false,
                messages:
                  messagesRef.current.length > 0
                    ? messagesRef.current
                    : oldCache?.messages || [],
              })
              setTestCache(userId, conversationId, {
                messages:
                  messagesRef.current.length > 0
                    ? messagesRef.current
                    : oldCache?.messages || [],
                isStreaming: false,
                timestamp: Date.now(),
              })
              justResolvedRef.current = conversationId
              onSessionCreatedRef.current?.(conversationId)
            }

            loadConversationsRef.current()
          },
          onWorkflowStarted: () => {
            setWorkflowRunning(true)
          },
          onWorkflowFinished: () => {
            setWorkflowRunning(false)
          },
          onError: (message) => {
            streamHandledEnd = true
            isStreamingRef.current = false
            setIsStreaming(false)
            sessionStorage.removeItem("test_streaming")
            abortControllerRef.current = null
            setWorkflowRunning(false)
            const lastMsg = messagesRef.current[messagesRef.current.length - 1]
            if (lastMsg?.isStreaming) {
              const updatedMessages = [
                ...messagesRef.current.slice(0, -1),
                { ...lastMsg, content: `错误: ${message}`, isStreaming: false },
              ]
              updateMessagesAndCache(updatedMessages, false)
            }
            setMessages((prev) => {
              const newMsgs = [...prev]
              const last = newMsgs[newMsgs.length - 1]
              if (last?.isStreaming) {
                newMsgs[newMsgs.length - 1] = {
                  ...last,
                  content: `错误: ${message}`,
                  isStreaming: false,
                }
              }
              return newMsgs
            })
          },
        },
        {
          conversationId: sessionIdRef.current || undefined,
          apiKeyName: "test",
          signal: abortController.signal,
        },
      )
    } catch (err) {
      abortControllerRef.current = null
      if (!streamHandledEnd) {
        setIsStreaming(false)
        sessionStorage.removeItem("test_streaming")
        const sid = sessionIdRef.current || ""
        unregisterStream(userId, sid)
        setMessages((prev) => {
          const newMsgs = [...prev]
          const last = newMsgs[newMsgs.length - 1]
          if (last?.isStreaming) {
            newMsgs[newMsgs.length - 1] = {
              ...last,
              content: `发送失败: ${err instanceof Error ? err.message : "未知错误"}`,
              isStreaming: false,
            }
          }
          return newMsgs
        })
      }
    }
  }

  // ── 提交测评答案 ────────────────────────────────────────────────────────────
  const handleTestSubmit = async () => {
    if (!activeTest) return
    const allAnswered = activeTest.questions.every(
      (q) => testAnswers[q.id] !== undefined,
    )
    if (!allAnswered) return

    const resultPayload = {
      test_id: activeTest.test_id,
      title: activeTest.title,
      answers: activeTest.questions.map((q) => ({
        id: q.id,
        answer: testAnswers[q.id].answer,
        score: testAnswers[q.id].score,
      })),
    }
    const resultText = `RESULT_JSON::${JSON.stringify(resultPayload)}`

    const capturedTest = activeTest
    const capturedAnswers = { ...testAnswers }
    const capturedTotalScore = resultPayload.answers.reduce(
      (sum: number, a: { score: number }) => sum + (a.score || 0),
      0,
    )

    setActiveTest(null)
    setTestAnswers({})
    setSubmissionStatus("submitting")
    stoppedRef.current = false

    setTimeout(() => setSubmissionStatus("analyzing"), 1000)

    setMessages((prev) => {
      const newMsgs = [...prev]
      const last = newMsgs[newMsgs.length - 1]
      if (last?.role === "assistant" && last.content.includes("已为您准备好")) {
        newMsgs[newMsgs.length - 1] = {
          ...last,
          content: `已提交《${capturedTest.title}》测评，正在生成分析报告...`,
        }
      }
      return newMsgs
    })

    setIsStreaming(true)
    sessionStorage.setItem("test_streaming", "true")
    setWorkflowRunning(false)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
        isStreaming: true,
        userQuery: resultText,
      },
    ])

    messagesRef.current = [
      ...messagesRef.current.slice(0, -1).map((m) =>
        m.role === "assistant" && m.content.includes("已为您准备好")
          ? {
              ...m,
              content: `已提交《${capturedTest.title}》测评，正在生成分析报告...`,
            }
          : m,
      ),
      {
        role: "assistant",
        content: "",
        isStreaming: true,
        userQuery: resultText,
      },
    ]

    // 在模块级注册表中注册此流
    const cacheSessionId = sessionId || ""
    registerStream(userId, cacheSessionId, {
      abortController,
      isStreaming: true,
      messages: messagesRef.current,
    })

    let accumulated = ""
    let streamHandledEnd = false

    try {
      await sendMessageStream(
        resultText,
        userId,
        {
          onMessage: (answer) => {
            if (stoppedRef.current) return
            accumulated += answer
            for (let i = messagesRef.current.length - 1; i >= 0; i--) {
              if (messagesRef.current[i]?.isStreaming) {
                const updatedMessages = [
                  ...messagesRef.current.slice(0, i),
                  { ...messagesRef.current[i], content: accumulated },
                  ...messagesRef.current.slice(i + 1),
                ]
                updateMessagesAndCache(updatedMessages, true)
                break
              }
            }
          },
          onMessageEnd: (_messageId, conversationId) => {
            streamHandledEnd = true
            isStreamingRef.current = false
            setIsStreaming(false)
            sessionStorage.removeItem("test_streaming")
            abortControllerRef.current = null
            setWorkflowRunning(false)
            setSubmissionStatus("done")
            for (let i = messagesRef.current.length - 1; i >= 0; i--) {
              if (messagesRef.current[i]?.isStreaming) {
                const updatedMessages = [
                  ...messagesRef.current.slice(0, i),
                  {
                    ...messagesRef.current[i],
                    content: accumulated,
                    isStreaming: false,
                  },
                  ...messagesRef.current.slice(i + 1),
                ]
                updateMessagesAndCache(updatedMessages, false)
                break
              }
            }
            setMessages((prev) => {
              const newMsgs = [...prev]
              for (let i = newMsgs.length - 1; i >= 0; i--) {
                if (newMsgs[i]?.isStreaming) {
                  newMsgs[i] = {
                    ...newMsgs[i],
                    content: accumulated,
                    isStreaming: false,
                  }
                  break
                }
              }
              return newMsgs
            })

            setTimeout(() => setSubmissionStatus("idle"), 2000)

            // 新会话创建：API 返回了真实 conversationId
            if (conversationId && !sessionIdRef.current) {
              const oldCache = getTestCache(userId, "")
              if (oldCache) {
                clearTestCache(userId, "")
              }
              unregisterStream(userId, "")
              registerStream(userId, conversationId, {
                abortController,
                isStreaming: false,
                messages:
                  messagesRef.current.length > 0
                    ? messagesRef.current
                    : oldCache?.messages || [],
              })
              setTestCache(userId, conversationId, {
                messages:
                  messagesRef.current.length > 0
                    ? messagesRef.current
                    : oldCache?.messages || [],
                isStreaming: false,
                timestamp: Date.now(),
              })
              justResolvedRef.current = conversationId
              onSessionCreatedRef.current?.(conversationId)
            }

            loadConversationsRef.current()

            // 保存测评记录到数据库
            const testName = capturedTest?.title || "心理测评"
            const questions =
              capturedTest?.questions.map((q) => ({
                id: q.id,
                text: q.text,
                type: q.type,
                options: q.options,
                scores: q.scores,
              })) || []
            const answers =
              capturedTest?.questions.map((q) => ({
                question_id: q.id,
                answer: capturedAnswers[q.id]?.answer,
                score: capturedAnswers[q.id]?.score,
              })) || []

            // 情感标签库
            const EMOTION_KEYWORDS = [
              "反刍思维",
              "自杀意念",
              "情绪波动",
              "述情障碍",
              "心理韧性",
              "物质使用",
              "自我形象",
              "人际关系",
              "躯体化",
              "情绪",
              "兴趣",
              "睡眠",
              "焦虑",
              "认知",
              "压力",
              "易怒",
              "社交",
              "动力",
              "精力",
              "躯体",
              "应对",
              "行为",
              "求助",
              "自尊",
              "退缩",
              "未来",
              "回避",
              "恐慌",
              "家庭",
              "适应",
              "支持",
              "敏感",
              "工作",
              "存在",
              "创伤",
              "冲动",
              "反应",
              "沟通",
              "解离",
            ]

            let userTopic: string | null = null
            for (const msg of messagesRef.current) {
              if (
                msg.role === "user" &&
                typeof msg.content === "string" &&
                !msg.content.startsWith("RESULT_JSON") &&
                !msg.content.startsWith("TEST_JSON")
              ) {
                const matched = EMOTION_KEYWORDS.find((kw) =>
                  msg.content.includes(kw),
                )
                if (matched) {
                  userTopic = matched
                  break
                }
              }
            }

            if (!userTopic) {
              userTopic =
                messagesRef.current.find(
                  (m) =>
                    m.role === "user" &&
                    typeof m.content === "string" &&
                    !m.content.startsWith("RESULT_JSON") &&
                    !m.content.startsWith("TEST_JSON"),
                )?.content || null
            }

            TestRecordsService.createRecord1({
              requestBody: {
                test_name: testName,
                user_topic: userTopic || undefined,
                total_score: capturedTotalScore,
                total_max: capturedTest?.scoring?.total_max || undefined,
                result_description: accumulated,
                questions: questions as unknown as Array<{
                  [key: string]: { [key: string]: unknown }
                }>,
                answers: answers as unknown as Array<{
                  [key: string]: { [key: string]: unknown }
                }>,
                scoring_ranges: (capturedTest?.scoring?.ranges || []) as unknown as Array<{
                  [key: string]: { [key: string]: unknown }
                }>,
                conversation_id: sessionIdRef.current || undefined,
              },
            })
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ["test-records"] })
              })
              .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err)
                console.error("[测评调试] 保存测评记录失败:", message)
              })
          },
          onWorkflowStarted: () => {
            setWorkflowRunning(true)
          },
          onWorkflowFinished: () => {
            setWorkflowRunning(false)
          },
          onError: (message) => {
            streamHandledEnd = true
            isStreamingRef.current = false
            setIsStreaming(false)
            sessionStorage.removeItem("test_streaming")
            abortControllerRef.current = null
            setWorkflowRunning(false)
            setSubmissionStatus("idle")
            for (let i = messagesRef.current.length - 1; i >= 0; i--) {
              if (messagesRef.current[i]?.isStreaming) {
                const updatedMessages = [
                  ...messagesRef.current.slice(0, i),
                  {
                    ...messagesRef.current[i],
                    content: `分析时出错: ${message}`,
                    isStreaming: false,
                  },
                  ...messagesRef.current.slice(i + 1),
                ]
                updateMessagesAndCache(updatedMessages, false)
                break
              }
            }
            setMessages((prev) => {
              const newMsgs = [...prev]
              for (let i = newMsgs.length - 1; i >= 0; i--) {
                if (newMsgs[i]?.isStreaming) {
                  newMsgs[i] = {
                    ...newMsgs[i],
                    content: `分析时出错: ${message}`,
                    isStreaming: false,
                  }
                  break
                }
              }
              return newMsgs
            })
          },
        },
        {
          conversationId: sessionIdRef.current || undefined,
          apiKeyName: "test",
          signal: abortController.signal,
        },
      )
    } catch (err) {
      abortControllerRef.current = null
      if (!streamHandledEnd) {
        setIsStreaming(false)
        sessionStorage.removeItem("test_streaming")
        setSubmissionStatus("idle")
        const sid = sessionIdRef.current || ""
        unregisterStream(userId, sid)
        setMessages((prev) => {
          const newMsgs = [...prev]
          for (let i = newMsgs.length - 1; i >= 0; i--) {
            if (newMsgs[i]?.isStreaming) {
              newMsgs[i] = {
                ...newMsgs[i],
                content: `发送失败: ${err instanceof Error ? err.message : "未知错误"}`,
                isStreaming: false,
              }
              break
            }
          }
          return newMsgs
        })
      }
    }
  }

  // ── 键盘快捷键 ──────────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 停止输出
  const handleStop = () => {
    stoppedRef.current = true

    const currentSessionId = sessionIdRef.current || ""
    const registryEntry = getStreamEntry(userId, currentSessionId)
    const controllerToAbort =
      registryEntry?.abortController || abortControllerRef.current

    if (controllerToAbort) {
      controllerToAbort.abort()
    }
    abortControllerRef.current = null
    isStreamingRef.current = false
    setIsStreaming(false)
    sessionStorage.removeItem("test_streaming")
    setWorkflowRunning(false)

    // 找到最后一个 streaming 的 assistant 消息
    let streamingIdx = -1
    for (let i = messagesRef.current.length - 1; i >= 0; i--) {
      if (
        messagesRef.current[i]?.role === "assistant" &&
        messagesRef.current[i]?.isStreaming
      ) {
        streamingIdx = i
        break
      }
    }

    // 区分 Case A（无内容）/ Case B（有内容）
    const streamingMsg =
      streamingIdx !== -1 ? messagesRef.current[streamingIdx] : null
    const isCaseA =
      !streamingMsg?.content ||
      streamingMsg.content === "正在生成测评题目..." ||
      streamingMsg.content === "思考中..."
    const stoppedContent = isCaseA ? "测评已停止" : streamingMsg?.content || ""

    // 更新 messagesRef
    messagesRef.current = messagesRef.current.map((m, idx) => {
      if (idx === streamingIdx) {
        return {
          ...m,
          content: stoppedContent,
          isStreaming: false,
          isPaused: true,
        }
      }
      return m.isStreaming ? { ...m, isStreaming: false } : m
    })

    // 清理注册表：unregisterStream 以阻止轮询调用 loadMessages（Bug 修复）
    unregisterStream(userId, currentSessionId)

    setTestCache(userId, currentSessionId, {
      messages: messagesRef.current,
      isStreaming: false,
      wasStopped: true,
      timestamp: Date.now(),
    })
    setMessages((prev) => {
      const newPrev = [...prev]
      let prevStreamingIdx = -1
      for (let i = newPrev.length - 1; i >= 0; i--) {
        if (newPrev[i]?.role === "assistant" && newPrev[i]?.isStreaming) {
          prevStreamingIdx = i
          break
        }
      }
      if (prevStreamingIdx !== -1) {
        newPrev[prevStreamingIdx] = {
          ...newPrev[prevStreamingIdx],
          content: stoppedContent,
          isStreaming: false,
          isPaused: true,
        }
      }
      return newPrev
    })
  }

  // 继续生成
  const handleContinue = async (messageIndex: number) => {
    const msg = messagesRef.current[messageIndex]
    if (!msg || msg.role !== "assistant" || !msg.isPaused) return

    // 如果处于历史版本，切回最新版本
    if (
      msg.versions &&
      msg.currentVersion !== undefined &&
      msg.currentVersion < msg.versions.length - 1
    ) {
      const latestContent = msg.versions[msg.versions.length - 1]
      messagesRef.current = messagesRef.current.map((m, idx) => {
        if (idx === messageIndex) {
          return {
            ...m,
            content: latestContent,
            currentVersion: msg.versions!.length - 1,
          }
        }
        return m
      })
    }

    const isCaseA = msg.content === "测评已停止"
    const continueContent = isCaseA ? "" : msg.content
    const query = msg.userQuery

    if (!query) {
      // fallback: 向前查找最近的 user 消息
      let foundQuery = ""
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messagesRef.current[i]?.role === "user") {
          foundQuery = messagesRef.current[i].content
          break
        }
      }
      if (!foundQuery) return
      // 更新 userQuery
      messagesRef.current = messagesRef.current.map((m, idx) => {
        if (idx === messageIndex) {
          return { ...m, userQuery: foundQuery }
        }
        return m
      })
    }

    const actualQuery = query || messagesRef.current[messageIndex].userQuery
    if (!actualQuery) return

    setIsStreaming(true)
    stoppedRef.current = false
    sessionStorage.setItem("test_streaming", "true")

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    messagesRef.current = messagesRef.current.map((m, idx) => {
      if (idx === messageIndex) {
        return {
          ...m,
          content: continueContent,
          isStreaming: true,
          isPaused: false,
        }
      }
      return m
    })
    setMessages([...messagesRef.current])

    const cacheSessionId = sessionIdRef.current || ""
    registerStream(userId, cacheSessionId, {
      abortController,
      isStreaming: true,
      messages: messagesRef.current,
    })

    let accumulated = continueContent
    let streamHandledEnd = false

    try {
      await sendMessageStream(
        actualQuery,
        userId,
        {
          onMessage(answer) {
            if (stoppedRef.current) return
            accumulated += answer
            const updatedMessages = messagesRef.current.map((m, idx) => {
              if (idx === messageIndex) {
                return { ...m, content: accumulated }
              }
              return m
            })
            messagesRef.current = updatedMessages
            updateStreamMessages(userId, cacheSessionId, updatedMessages)
            setTestCache(userId, cacheSessionId, {
              messages: updatedMessages,
              isStreaming: true,
              timestamp: Date.now(),
            })
            setMessages(updatedMessages)
          },
          onMessageEnd(_messageId, conversationId) {
            streamHandledEnd = true
            isStreamingRef.current = false
            setIsStreaming(false)
            sessionStorage.removeItem("test_streaming")
            abortControllerRef.current = null

            const finalMessages = messagesRef.current.map((m, idx) => {
              if (idx === messageIndex) {
                return {
                  ...m,
                  content: accumulated,
                  isStreaming: false,
                  isPaused: false,
                }
              }
              return m
            })
            messagesRef.current = finalMessages
            updateMessagesAndCache(finalMessages, false)

            if (conversationId && !sessionIdRef.current) {
              const oldCache = getTestCache(userId, "")
              if (oldCache) clearTestCache(userId, "")
              unregisterStream(userId, "")
              registerStream(userId, conversationId, {
                abortController,
                isStreaming: false,
                messages:
                  messagesRef.current.length > 0
                    ? messagesRef.current
                    : oldCache?.messages || [],
              })
              setTestCache(userId, conversationId, {
                messages:
                  messagesRef.current.length > 0
                    ? messagesRef.current
                    : oldCache?.messages || [],
                isStreaming: false,
                timestamp: Date.now(),
              })
              justResolvedRef.current = conversationId
              onSessionCreatedRef.current?.(conversationId)
            }

            setMessages(finalMessages)
            loadConversationsRef.current()
          },
          onError(message) {
            streamHandledEnd = true
            isStreamingRef.current = false
            setIsStreaming(false)
            sessionStorage.removeItem("test_streaming")
            abortControllerRef.current = null

            const errorMessages = messagesRef.current.map((m, idx) => {
              if (idx === messageIndex) {
                return {
                  ...m,
                  content: `错误: ${message}`,
                  isStreaming: false,
                  isPaused: false,
                }
              }
              return m
            })
            messagesRef.current = errorMessages
            updateMessagesAndCache(errorMessages, false)
            setMessages(errorMessages)
          },
        },
        {
          conversationId: sessionIdRef.current || undefined,
          apiKeyName: "test",
          signal: abortController.signal,
        },
      )
    } catch (err) {
      abortControllerRef.current = null
      if (!streamHandledEnd) {
        setIsStreaming(false)
        sessionStorage.removeItem("test_streaming")
        const sid = sessionIdRef.current || ""
        unregisterStream(userId, sid)
        const errorMessages = messagesRef.current.map((m, idx) => {
          if (idx === messageIndex) {
            return {
              ...m,
              content: `继续生成失败: ${err instanceof Error ? err.message : "未知错误"}`,
              isStreaming: false,
              isPaused: false,
            }
          }
          return m
        })
        messagesRef.current = errorMessages
        setTestCache(userId, sid, {
          messages: errorMessages,
          isStreaming: false,
          timestamp: Date.now(),
        })
        setMessages(errorMessages)
      }
    }
  }

  // 重新生成
  const handleRegenerate = async (messageIndex: number) => {
    const msg = messagesRef.current[messageIndex]
    if (!msg || msg.role !== "assistant") return

    // 如果处于历史版本，先切回最新版本
    const versions = msg.versions ? [...msg.versions] : [msg.content]
    const latestContent = versions[versions.length - 1]

    messagesRef.current = messagesRef.current.map((m, idx) => {
      if (idx === messageIndex) {
        return {
          ...m,
          versions,
          currentVersion: versions.length - 1,
          content: latestContent,
        }
      }
      return m
    })

    const query = msg.userQuery
    if (!query) {
      let foundQuery = ""
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messagesRef.current[i]?.role === "user") {
          foundQuery = messagesRef.current[i].content
          break
        }
      }
      if (!foundQuery) return
      messagesRef.current = messagesRef.current.map((m, idx) => {
        if (idx === messageIndex) {
          return { ...m, userQuery: foundQuery }
        }
        return m
      })
    }

    const actualQuery = query || messagesRef.current[messageIndex].userQuery
    if (!actualQuery) return

    setIsStreaming(true)
    stoppedRef.current = false
    sessionStorage.setItem("test_streaming", "true")

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    messagesRef.current = messagesRef.current.map((m, idx) => {
      if (idx === messageIndex) {
        return { ...m, content: "", isStreaming: true, isPaused: false }
      }
      return m
    })
    setMessages([...messagesRef.current])

    const cacheSessionId = sessionIdRef.current || ""
    registerStream(userId, cacheSessionId, {
      abortController,
      isStreaming: true,
      messages: messagesRef.current,
    })

    let accumulated = ""
    let streamHandledEnd = false

    try {
      await sendMessageStream(
        actualQuery,
        userId,
        {
          onMessage(answer) {
            if (stoppedRef.current) return
            accumulated += answer
            const updatedMessages = messagesRef.current.map((m, idx) => {
              if (idx === messageIndex) {
                return { ...m, content: accumulated }
              }
              return m
            })
            messagesRef.current = updatedMessages
            updateStreamMessages(userId, cacheSessionId, updatedMessages)
            setTestCache(userId, cacheSessionId, {
              messages: updatedMessages,
              isStreaming: true,
              timestamp: Date.now(),
            })
            setMessages(updatedMessages)
          },
          onMessageEnd(_messageId, conversationId) {
            streamHandledEnd = true
            isStreamingRef.current = false
            setIsStreaming(false)
            sessionStorage.removeItem("test_streaming")
            abortControllerRef.current = null

            const newVersions = [...versions, accumulated]
            const finalMessages = messagesRef.current.map((m, idx) => {
              if (idx === messageIndex) {
                return {
                  ...m,
                  content: accumulated,
                  isStreaming: false,
                  isPaused: false,
                  versions: newVersions,
                  currentVersion: newVersions.length - 1,
                }
              }
              return m
            })
            messagesRef.current = finalMessages
            updateMessagesAndCache(finalMessages, false)

            if (conversationId && !sessionIdRef.current) {
              const oldCache = getTestCache(userId, "")
              if (oldCache) clearTestCache(userId, "")
              unregisterStream(userId, "")
              registerStream(userId, conversationId, {
                abortController,
                isStreaming: false,
                messages:
                  messagesRef.current.length > 0
                    ? messagesRef.current
                    : oldCache?.messages || [],
              })
              setTestCache(userId, conversationId, {
                messages:
                  messagesRef.current.length > 0
                    ? messagesRef.current
                    : oldCache?.messages || [],
                isStreaming: false,
                timestamp: Date.now(),
              })
              justResolvedRef.current = conversationId
              onSessionCreatedRef.current?.(conversationId)
            }

            setMessages(finalMessages)
            loadConversationsRef.current()
          },
          onError(message) {
            streamHandledEnd = true
            isStreamingRef.current = false
            setIsStreaming(false)
            sessionStorage.removeItem("test_streaming")
            abortControllerRef.current = null

            const errorMessages = messagesRef.current.map((m, idx) => {
              if (idx === messageIndex) {
                return {
                  ...m,
                  content: `错误: ${message}`,
                  isStreaming: false,
                  isPaused: false,
                  versions,
                  currentVersion: versions.length - 1,
                }
              }
              return m
            })
            messagesRef.current = errorMessages
            updateMessagesAndCache(errorMessages, false)
            setMessages(errorMessages)
          },
        },
        {
          conversationId: sessionIdRef.current || undefined,
          apiKeyName: "test",
          signal: abortController.signal,
        },
      )
    } catch (err) {
      abortControllerRef.current = null
      if (!streamHandledEnd) {
        setIsStreaming(false)
        sessionStorage.removeItem("test_streaming")
        const sid = sessionIdRef.current || ""
        unregisterStream(userId, sid)
        const errorMessages = messagesRef.current.map((m, idx) => {
          if (idx === messageIndex) {
            return {
              ...m,
              content: `重新生成失败: ${err instanceof Error ? err.message : "未知错误"}`,
              isStreaming: false,
              isPaused: false,
              versions,
              currentVersion: versions.length - 1,
            }
          }
          return m
        })
        messagesRef.current = errorMessages
        setTestCache(userId, sid, {
          messages: errorMessages,
          isStreaming: false,
          timestamp: Date.now(),
        })
        setMessages(errorMessages)
      }
    }
  }

  // 切换版本
  const handleSwitchVersion = (messageIndex: number, direction: -1 | 1) => {
    const msg = messagesRef.current[messageIndex]
    if (!msg.versions || msg.versions.length <= 1) return
    const newVersion = (msg.currentVersion || 0) + direction
    if (newVersion < 0 || newVersion >= msg.versions.length) return

    const newContent = msg.versions[newVersion]
    const updatedMessages = messagesRef.current.map((m, idx) => {
      if (idx === messageIndex) {
        return { ...m, content: newContent, currentVersion: newVersion }
      }
      return m
    })
    messagesRef.current = updatedMessages
    updateMessagesAndCache(updatedMessages, false)
    setMessages(updatedMessages)
  }

  // ── 答题进度 ────────────────────────────────────────────────────────────────
  const answeredCount = activeTest
    ? activeTest.questions.filter((q) => testAnswers[q.id] !== undefined).length
    : 0
  const totalCount = activeTest?.questions.length ?? 0
  const allAnswered = answeredCount === totalCount && totalCount > 0
  const progressPct = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0

  return {
    messages,
    setMessages,
    inputText,
    setInputText,
    isStreaming,
    activeTest,
    setActiveTest,
    testAnswers,
    setTestAnswers,
    submissionStatus,
    workflowRunning,
    messagesEndRef,
    inputRef,
    loadMessages,
    handleSend,
    handleStop,
    handleContinue,
    handleRegenerate,
    handleSwitchVersion,
    handleTestSubmit,
    handleKeyDown,
    answeredCount,
    totalCount,
    allAnswered,
    progressPct,
  }
}
