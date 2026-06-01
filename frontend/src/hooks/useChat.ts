import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import {
  type DifyMessageFile,
  getMessages,
  sendMessageStream,
  uploadFile,
} from "@/services/difyApi"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  files?: DifyMessageFile[]
  isStreaming?: boolean
  isPaused?: boolean
  userQuery?: string
  versions?: string[]
  currentVersion?: number
}

const CACHE_TTL = 30 * 60 * 1000 // 30 分钟
const CHAT_CACHE_PREFIX = "emomind_chat_messages"

interface ChatCacheData {
  messages: ChatMessage[]
  isStreaming: boolean
  wasStopped?: boolean
  timestamp: number
}

function getChatCacheKey(userId: string, sessionId: string) {
  return `${CHAT_CACHE_PREFIX}_${userId}_${sessionId || "new"}`
}

function getChatCache(userId: string, sessionId: string): ChatCacheData | null {
  try {
    const data = sessionStorage.getItem(getChatCacheKey(userId, sessionId))
    if (data) {
      const parsed = JSON.parse(data) as ChatCacheData
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

function setChatCache(userId: string, sessionId: string, data: ChatCacheData) {
  try {
    sessionStorage.setItem(
      getChatCacheKey(userId, sessionId),
      JSON.stringify(data),
    )
  } catch {
    // ignore
  }
}

function clearChatCache(userId: string, sessionId: string) {
  sessionStorage.removeItem(getChatCacheKey(userId, sessionId))
}

// ── 模块级流式状态注册表 ─────────────────────────────────────────────────────
interface StreamRegistryEntry {
  abortController: AbortController
  isStreaming: boolean
  messages: ChatMessage[]
}

const streamRegistry = new Map<string, StreamRegistryEntry>()

function getStreamKey(userId: string, sessionId: string) {
  return `${userId}::${sessionId || ""}`
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

export function useChat(
  userId: string,
  sessionId: string,
  setActiveConvId: (id: string) => void,
  loadConversations: () => void,
  onSessionCreated?: (conversationId: string) => void,
  apiKeyName: string = "ai-doctor",
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [_streamingContent, setStreamingContent] = useState("")
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
        // 1. 优先从流式注册表恢复
        const registryEntry = getStreamEntry(userId, sessionId)
        if (registryEntry) {
          setMessages(registryEntry.messages)
          setIsStreaming(registryEntry.isStreaming)
          if (registryEntry.isStreaming) {
            abortControllerRef.current = registryEntry.abortController
          }
          return
        }

        // 2. 其次从 sessionStorage 缓存恢复
        const cached = getChatCache(userId, sessionId)
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

      // 3. 无缓存数据 / 基础路由 → 清空消息
      setMessages([])
      setIsStreaming(false)
    }
  }, [sessionId, userId])

  // 加载某个会话的消息
  const loadMessages = useCallback(
    async (convId: string) => {
      // 身份未解析前不请求 API，避免 "anonymous" 导致假 404
      // userId 变为真实值后 useEffect 会自动重试
      if (userId === "anonymous") return

      loadingConvIdRef.current = convId
      setIsStreaming(false)
      sessionStorage.removeItem(`${apiKeyName}_streaming`)
      // 注意：不在这里清缓存和消息，避免 API 请求期间页面闪空白
      // API 返回后再整体替换
      try {
        const result = await getMessages(userId, convId, {
          apiKeyName,
        })
        // 竞态保护：如果已经切换到其他会话，丢弃此结果
        if (loadingConvIdRef.current !== convId) return
        // API 成功后才清旧缓存并写入新数据
        clearChatCache(userId, convId)
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
          if (msg.query) {
            chatMsgs.push({
              role: "user",
              content: msg.query,
              files: msg.message_files,
            })
          }
          if (msg.answer) {
            const existing = existingAssistants[assistantIdx]
            chatMsgs.push({
              role: "assistant",
              content: msg.answer,
              files: msg.message_files,
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
    [userId, apiKeyName],
  )

  // 当 sessionId 变化时加载消息
  useEffect(() => {
    let cancelled = false
    let pollingTimer: ReturnType<typeof setInterval> | null = null
    const run = async () => {
      // 如果此会话刚刚被创建（onMessageEnd 迁移后），跳过重新加载
      if (justResolvedRef.current === sessionId) {
        justResolvedRef.current = null
        return
      }

      // 如果此会话 ID 之前已确认不存在（404），不再重复请求
      if (sessionId && notFoundIdsRef.current.has(`${userId}:${sessionId}`)) {
        setMessages([])
        setIsStreaming(false)
        setActiveConvId("")
        return
      }

      if (sessionId) {
        // ── 有 sessionId：优先从注册表/缓存恢复，否则从 API 加载 ────────
        // 优先检查模块级流式注册表
        const registryEntry = getStreamEntry(userId, sessionId)
        if (registryEntry?.isStreaming) {
          // 从注册表恢复流式状态
          setMessages(registryEntry.messages)
          setIsStreaming(true)
          abortControllerRef.current = registryEntry.abortController

          // 启动轮询，检测流式请求是否完成
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
              // 流式请求仍在进行，更新消息内容
              setMessages(entry.messages)
            }
          }, 300)
          return
        }

        // 其次检查注册表中是否存在已完成的流
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

        // 再检查 sessionStorage 缓存
        const cached = getChatCache(userId, sessionId)
        if (cached && cached.messages.length > 0) {
          setMessages(cached.messages)
          setIsStreaming(cached.isStreaming)
          if (cached.isStreaming) {
            // 缓存显示正在流式，但注册表没有 → 页面刷新，旧流已丢失
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
            setChatCache(userId, sessionId, {
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
        if (sessionStorage.getItem(`${apiKeyName}_streaming`) === "true") {
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
              // 不需要 unregister：onMessageEnd 已经迁移到真实 ID
            } else {
              setMessages(entry.messages)
            }
          }, 300)
          return
        }

        // 不恢复已完成的流或 sessionStorage 缓存，基础路由始终显示空状态
        setMessages([])
        setIsStreaming(false)
      }
    }
    run()
    return () => {
      cancelled = true
      if (pollingTimer) clearInterval(pollingTimer)
    }
  }, [sessionId, loadMessages, userId, apiKeyName, setActiveConvId])

  // 挂载状态跟踪 + 组件卸载时保存缓存
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (messagesRef.current.length > 0) {
        setChatCache(userId, sessionIdRef.current, {
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

  // 辅助函数：同时更新 ref、注册表和缓存
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
    setChatCache(userId, sid, {
      messages: updatedMessages,
      isStreaming: streaming,
      timestamp: Date.now(),
    })
  }

  // 发送消息
  const handleSend = async (extraFiles?: File[]) => {
    const text = inputText.trim()
    const filesToSend = [...(extraFiles || []), ...attachedFiles]
    if (!text && filesToSend.length === 0) return
    if (isStreaming) return

    stoppedRef.current = false

    const userMsg: ChatMessage = { role: "user", content: text }
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      isStreaming: true,
      userQuery: text,
    }

    // 先更新 messagesRef.current（保留历史消息），再 setMessages
    const nextMessages = [...messagesRef.current, userMsg, assistantMsg]
    messagesRef.current = nextMessages

    // 立即保存到缓存
    setChatCache(userId, sessionId || "", {
      messages: nextMessages,
      isStreaming: true,
      timestamp: Date.now(),
    })

    setMessages((prev) => [...prev, userMsg])
    setInputText("")
    setStreamingContent("")
    setIsStreaming(true)
    sessionStorage.setItem(`${apiKeyName}_streaming`, "true")

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setMessages((prev) => [...prev, assistantMsg])

    // 在模块级注册表中注册此流
    const cacheSessionId = sessionId || ""
    registerStream(userId, cacheSessionId, {
      abortController,
      isStreaming: true,
      messages: nextMessages,
    })

    const uploadedFiles: {
      type: string
      transfer_method: string
      url: string
      upload_file_id?: string
    }[] = []
    for (const file of filesToSend) {
      try {
        const result = await uploadFile(file, userId, apiKeyName)
        uploadedFiles.push({
          type: file.type.startsWith("audio")
            ? "audio"
            : file.type.startsWith("video")
              ? "video"
              : file.type.startsWith("image")
                ? "image"
                : "document",
          transfer_method: "local_file",
          url: result.id,
          upload_file_id: result.id,
        })
      } catch {
        // skip
      }
    }
    setAttachedFiles([])

    let accumulated = ""
    let streamHandledEnd = false

    try {
      await sendMessageStream(
        text,
        userId,
        {
          onMessage(answer) {
            if (stoppedRef.current) return
            accumulated += answer
            // 剥离 "正在分析中，请稍候..." 前缀
            if (
              accumulated.startsWith("正在分析中，请稍候...\n") &&
              answer.trim().length > 0
            ) {
              accumulated = accumulated.replace(/^正在分析中，请稍候...\n?/, "")
            }
            const lastMsg = messagesRef.current[messagesRef.current.length - 1]
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
                newMsgs[newMsgs.length - 1] = { ...last, content: accumulated }
              }
              return newMsgs
            })
          },
          onMessageEnd(_messageId, conversationId) {
            streamHandledEnd = true
            isStreamingRef.current = false
            setIsStreaming(false)
            sessionStorage.removeItem(`${apiKeyName}_streaming`)
            abortControllerRef.current = null

            const stripWorkflowPrefix = (content: string) =>
              content.replace(/^正在分析中，请稍候...\n?/, "")

            // 更新 messagesRef、注册表和缓存
            if (messagesRef.current.length > 0) {
              const last = messagesRef.current[messagesRef.current.length - 1]
              if (last?.isStreaming) {
                const finalContent = stripWorkflowPrefix(last.content)
                const updatedMessages = [
                  ...messagesRef.current.slice(0, -1),
                  { ...last, content: finalContent, isStreaming: false },
                ]
                updateMessagesAndCache(updatedMessages, false)
              }
            }

            // 新会话创建：API 返回了真实 conversationId
            if (conversationId && !sessionIdRef.current) {
              // 从 "" key 迁移到真实 conversationId
              const oldCache = getChatCache(userId, "")
              if (oldCache) {
                clearChatCache(userId, "")
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
              setChatCache(userId, conversationId, {
                messages:
                  messagesRef.current.length > 0
                    ? messagesRef.current
                    : oldCache?.messages || [],
                isStreaming: false,
                timestamp: Date.now(),
              })
              justResolvedRef.current = conversationId

              // 通知组件新会话已创建（组件决定是否导航）
              onSessionCreatedRef.current?.(conversationId)
            }

            setMessages((prev) => {
              const newMsgs = [...prev]
              const last = newMsgs[newMsgs.length - 1]
              if (last?.isStreaming) {
                const finalContent = last.content.replace(
                  /^正在分析中，请稍候...\n?/,
                  "",
                )
                newMsgs[newMsgs.length - 1] = {
                  ...last,
                  content: finalContent,
                  isStreaming: false,
                }
              }
              return newMsgs
            })
            loadConversationsRef.current()
          },
          onWorkflowStarted() {
            accumulated = "正在分析中，请稍候...\n"
            const lastMsg = messagesRef.current[messagesRef.current.length - 1]
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
          },
          onError(message) {
            streamHandledEnd = true
            isStreamingRef.current = false
            setIsStreaming(false)
            sessionStorage.removeItem(`${apiKeyName}_streaming`)
            abortControllerRef.current = null
            if (messagesRef.current.length > 0) {
              const last = messagesRef.current[messagesRef.current.length - 1]
              if (last?.isStreaming) {
                const updatedMessages = [
                  ...messagesRef.current.slice(0, -1),
                  { ...last, content: `错误: ${message}`, isStreaming: false },
                ]
                updateMessagesAndCache(updatedMessages, false)
              }
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
          conversationId: sessionId || undefined,
          files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
          apiKeyName,
          signal: abortController.signal,
        },
      )
    } catch (err) {
      abortControllerRef.current = null
      if (!streamHandledEnd) {
        setIsStreaming(false)
        sessionStorage.removeItem(`${apiKeyName}_streaming`)
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

  // 键盘事件
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
    sessionStorage.removeItem(`${apiKeyName}_streaming`)

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
      streamingMsg.content === "正在分析中，请稍候...\n" ||
      streamingMsg.content === "思考中..."
    const stoppedContent = isCaseA ? "咨询已停止" : streamingMsg?.content || ""

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

    setChatCache(userId, currentSessionId, {
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

    const isCaseA = msg.content === "咨询已停止"
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
    sessionStorage.setItem(`${apiKeyName}_streaming`, "true")

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
            if (
              accumulated.startsWith("正在分析中，请稍候...\n") &&
              answer.trim().length > 0
            ) {
              accumulated = accumulated.replace(/^正在分析中，请稍候...\n?/, "")
            }
            const updatedMessages = messagesRef.current.map((m, idx) => {
              if (idx === messageIndex) {
                return { ...m, content: accumulated }
              }
              return m
            })
            messagesRef.current = updatedMessages
            updateStreamMessages(userId, cacheSessionId, updatedMessages)
            setChatCache(userId, cacheSessionId, {
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
            sessionStorage.removeItem(`${apiKeyName}_streaming`)
            abortControllerRef.current = null

            const finalContent = accumulated.replace(
              /^正在分析中，请稍候...\n?/,
              "",
            )
            const finalMessages = messagesRef.current.map((m, idx) => {
              if (idx === messageIndex) {
                return {
                  ...m,
                  content: finalContent,
                  isStreaming: false,
                  isPaused: false,
                }
              }
              return m
            })
            messagesRef.current = finalMessages
            updateMessagesAndCache(finalMessages, false)

            if (conversationId && !sessionIdRef.current) {
              const oldCache = getChatCache(userId, "")
              if (oldCache) clearChatCache(userId, "")
              unregisterStream(userId, "")
              registerStream(userId, conversationId, {
                abortController,
                isStreaming: false,
                messages:
                  messagesRef.current.length > 0
                    ? messagesRef.current
                    : oldCache?.messages || [],
              })
              setChatCache(userId, conversationId, {
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
            sessionStorage.removeItem(`${apiKeyName}_streaming`)
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
          apiKeyName,
          signal: abortController.signal,
        },
      )
    } catch (err) {
      abortControllerRef.current = null
      if (!streamHandledEnd) {
        setIsStreaming(false)
        sessionStorage.removeItem(`${apiKeyName}_streaming`)
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
        setChatCache(userId, sid, {
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
    sessionStorage.setItem(`${apiKeyName}_streaming`, "true")

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
            if (
              accumulated.startsWith("正在分析中，请稍候...\n") &&
              answer.trim().length > 0
            ) {
              accumulated = accumulated.replace(/^正在分析中，请稍候...\n?/, "")
            }
            const updatedMessages = messagesRef.current.map((m, idx) => {
              if (idx === messageIndex) {
                return { ...m, content: accumulated }
              }
              return m
            })
            messagesRef.current = updatedMessages
            updateStreamMessages(userId, cacheSessionId, updatedMessages)
            setChatCache(userId, cacheSessionId, {
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
            sessionStorage.removeItem(`${apiKeyName}_streaming`)
            abortControllerRef.current = null

            const finalContent = accumulated.replace(
              /^正在分析中，请稍候...\n?/,
              "",
            )
            const newVersions = [...versions, finalContent]
            const finalMessages = messagesRef.current.map((m, idx) => {
              if (idx === messageIndex) {
                return {
                  ...m,
                  content: finalContent,
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
              const oldCache = getChatCache(userId, "")
              if (oldCache) clearChatCache(userId, "")
              unregisterStream(userId, "")
              registerStream(userId, conversationId, {
                abortController,
                isStreaming: false,
                messages:
                  messagesRef.current.length > 0
                    ? messagesRef.current
                    : oldCache?.messages || [],
              })
              setChatCache(userId, conversationId, {
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
            sessionStorage.removeItem(`${apiKeyName}_streaming`)
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
          apiKeyName,
          signal: abortController.signal,
        },
      )
    } catch (err) {
      abortControllerRef.current = null
      if (!streamHandledEnd) {
        setIsStreaming(false)
        sessionStorage.removeItem(`${apiKeyName}_streaming`)
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
        setChatCache(userId, sid, {
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

  // 文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...Array.from(files)])
    }
    if (e.target) {
      e.target.value = ""
    }
  }

  // 根据文件类型分类
  const categorizeFile = (file: File) => {
    if (file.type.startsWith("audio")) {
      return "audio"
    }
    if (file.type.startsWith("video")) {
      return "video"
    }
    if (
      file.type.startsWith("text") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".doc") ||
      file.name.endsWith(".docx") ||
      file.name.endsWith(".pdf")
    ) {
      return "text"
    }
    return "document"
  }

  // 移除附件
  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return {
    messages,
    setMessages,
    inputText,
    setInputText,
    isStreaming,
    attachedFiles,
    setAttachedFiles,
    messagesEndRef,
    handleSend,
    handleStop,
    handleContinue,
    handleRegenerate,
    handleSwitchVersion,
    handleKeyDown,
    handleFileSelect,
    categorizeFile,
    removeAttachment,
  }
}
