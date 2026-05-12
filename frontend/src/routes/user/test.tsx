import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CheckCircle2, ClipboardList, Info, Loader2, Send } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { TestRecordsService } from "@/client"
import { useConversation } from "@/components/contexts/ConversationContext"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"
import { useCurrentTheme } from "@/hooks/useCurrentTheme"
import {
  DIFY_TEST_API_KEY,
  getMessages,
  sendMessageStream,
} from "@/services/difyApi"

export const Route = createFileRoute("/user/test")({
  component: PsychologicalTest,
  head: () => ({
    meta: [{ title: "心理测评" }],
  }),
})

/**
 * 预处理 Markdown 内容：
 * 将连续的 Tab 分隔行（≥2 行）转成标准 Markdown 表格
 */
function preprocessMarkdown(text: string | undefined | null): string {
  if (text == null || typeof text !== "string") {
    return ""
  }
  const lines = text.split("\n")
  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line == null) {
      i++
      continue
    }
    // 收集连续的 Tab 行
    if (line.includes("\t")) {
      const buffer: string[] = []
      while (i < lines.length && lines[i]?.includes("\t")) {
        buffer.push(lines[i])
        i++
      }
      if (buffer.length >= 2) {
        // 转成 Markdown 表格
        const header = buffer[0]
          .split("\t")
          .map((c) => (c != null ? c.trim() : ""))
          .join(" | ")
        const sep = header
          .split(" | ")
          .map(() => "---")
          .join(" | ")
        result.push(`| ${header} |`)
        result.push(`| ${sep} |`)
        for (let j = 1; j < buffer.length; j++) {
          const row = buffer[j]
            .split("\t")
            .map((c) => (c != null ? c.trim() : ""))
            .join(" | ")
          result.push(`| ${row} |`)
        }
      } else {
        result.push(...buffer)
      }
    } else {
      result.push(line)
      i++
    }
  }

  return result.join("\n")
}

// ─── 类型定义 ────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}

interface TestQuestion {
  id: string
  text: string
  type: string
  options: string[]
  scores: number[]
}

interface TestData {
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

type SubmissionStatus = "idle" | "submitting" | "analyzing" | "done"

// ─── 组件 ────────────────────────────────────────────────────────────────────

function PsychologicalTest() {
  const { user } = useAuth()
  const userId = user?.id || "anonymous"
  const { activeConvId, setActiveConvId, loadConversations } = useConversation()
  const queryClient = useQueryClient()
  const { isWarmTheme } = useCurrentTheme()

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

  // workflow 运行状态（独立于消息内容，不占气泡）
  const [workflowRunning, setWorkflowRunning] = useState(false)

  // UI refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── 加载历史消息 ────────────────────────────────────────────────────────────
  const loadMessages = useCallback(
    async (convId: string) => {
      try {
        const result = await getMessages(userId, convId, {
          apiKey: DIFY_TEST_API_KEY,
        })
        const chatMsgs: ChatMessage[] = []
        const sorted = [...result.data].sort(
          (a, b) => a.created_at - b.created_at,
        )
        for (const msg of sorted) {
          if (msg.query && typeof msg.query === "string") {
            // 历史消息中过滤掉 RESULT_JSON 前缀的用户消息
            if (!msg.query.startsWith("RESULT_JSON::")) {
              chatMsgs.push({ role: "user", content: msg.query })
            }
          }
          if (msg.answer && typeof msg.answer === "string") {
            // 历史消息中过滤掉 TEST_JSON 内容，只保留引导文字
            const testJsonIdx = msg.answer.indexOf("TEST_JSON::")
            if (testJsonIdx !== -1) {
              const prefixText = msg.answer.slice(0, testJsonIdx).trim()
              if (prefixText) {
                chatMsgs.push({ role: "assistant", content: prefixText })
              }
            } else if (!msg.answer.startsWith("RESULT_JSON::")) {
              chatMsgs.push({ role: "assistant", content: msg.answer })
            }
          }
        }
        setMessages(chatMsgs)
      } catch (error) {
        // 404 表示会话不存在（可能被删除），重置 activeConvId
        if (error instanceof Error && error.message.includes("404")) {
          setActiveConvId("")
        }
        setMessages([])
      }
    },
    [userId, setActiveConvId],
  )

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId)
    } else {
      setMessages([])
    }
  }, [activeConvId, loadMessages])

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  // ── 解析 TEST_JSON ──────────────────────────────────────────────────────────
  const tryParseTestJson = (content: string | undefined | null): TestData | null => {
    if (content == null || typeof content !== "string") {
      return null
    }
    const PREFIX = "TEST_JSON::"
    // AI 可能在 TEST_JSON 前有其他文字（如"好的，明白您想要..."），所以查找子串而不是开头匹配
    const idx = content.indexOf(PREFIX)
    if (idx === -1) return null
    try {
      const raw = content.slice(idx + PREFIX.length).trim()
      return JSON.parse(raw) as TestData
    } catch {
      return null
    }
  }

  // ── 普通消息发送 ────────────────────────────────────────────────────────────
  const handleSend = async (overrideText?: string, silent?: boolean) => {
    const text = (overrideText !== undefined ? overrideText : inputText).trim()
    if (!text) return
    if (isStreaming) return

    // 非静默发送才添加用户消息
    if (!silent) {
      setMessages((prev) => [...prev, { role: "user", content: text }])
      setInputText("")
    }

    setIsStreaming(true)
    setWorkflowRunning(false)

    // 添加 assistant 占位
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", isStreaming: true },
    ])

    let accumulated = ""
    let streamHandledEnd = false
    let detectedTest: TestData | null = null

    try {
      await sendMessageStream(
        text,
        userId,
        {
          onMessage: (answer) => {
            accumulated += answer
            // 实时检测是否包含 TEST_JSON 子串
            if (!detectedTest && accumulated.includes("TEST_JSON::")) {
              // 尝试解析（可能还不完整，等 onMessageEnd 处理）
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
              // 普通文本消息，实时展示
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
            setIsStreaming(false)
            setWorkflowRunning(false)

            // 检测完整消息是否包含 TEST_JSON
            const parsed = tryParseTestJson(accumulated)
            if (parsed) {
              detectedTest = parsed
              // 提取 TEST_JSON 之前的文字（AI 回复的引导语）
              const prefixText = accumulated
                .slice(0, accumulated.indexOf("TEST_JSON::"))
                .trim()
              const displayContent = prefixText
                ? `${prefixText}\n\n已为您准备好《${parsed.title}》，请在下方完成作答。`
                : `已为您准备好《${parsed.title}》，请在下方完成作答。`
              // 将占位消息替换为提示文本
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
              setMessages((prev) => {
                const newMsgs = [...prev]
                const last = newMsgs[newMsgs.length - 1]
                if (last?.isStreaming) {
                  newMsgs[newMsgs.length - 1] = { ...last, isStreaming: false }
                }
                return newMsgs
              })
            }

            if (conversationId && !activeConvId) {
              setActiveConvId(conversationId)
            }
            loadConversations()
          },
          onWorkflowStarted: () => {
            setWorkflowRunning(true)
          },
          onWorkflowFinished: () => {
            setWorkflowRunning(false)
          },
          onError: (message) => {
            streamHandledEnd = true
            setIsStreaming(false)
            setWorkflowRunning(false)
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
          conversationId: activeConvId || undefined,
          apiKey: DIFY_TEST_API_KEY,
        },
      )
    } catch (err) {
      if (!streamHandledEnd) {
        setIsStreaming(false)
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

    // 构造 RESULT_JSON
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

    // 在清除状态前先捕获当前值（避免异步闭包陷阱）
    const capturedTest = activeTest
    const capturedAnswers = { ...testAnswers }

    // 清除答题界面
    setActiveTest(null)
    setTestAnswers({})
    setSubmissionStatus("submitting")

    // 状态流转：提交成功 → 开始分析
    setTimeout(() => setSubmissionStatus("analyzing"), 1000)

    // 把之前的"已为您准备好测评"消息替换为"已提交"
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

    // 静默发送（不添加 user 消息到界面）
    setIsStreaming(true)
    setWorkflowRunning(false)

    // 添加一个新的 assistant 占位消息，用于接收分析报告
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", isStreaming: true },
    ])

    let accumulated = ""
    let streamHandledEnd = false

    try {
      await sendMessageStream(
        resultText,
        userId,
        {
          onMessage: (answer) => {
            accumulated += answer
          },
          onMessageEnd: (_messageId, conversationId) => {
            streamHandledEnd = true
            setIsStreaming(false)
            setWorkflowRunning(false)
            setSubmissionStatus("done")
            setMessages((prev) => {
              const newMsgs = [...prev]
              // 从后往前找最后一个 isStreaming 的消息
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
            // 分析完成后短暂显示再归 idle
            setTimeout(() => setSubmissionStatus("idle"), 2000)
            if (conversationId && !activeConvId) {
              setActiveConvId(conversationId)
            }
            loadConversations()

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

            // 提取用户输入的主题（第一条用户消息，非 RESULT_JSON）
            const userTopic =
              messages.find(
                (m) =>
                  m.role === "user" &&
                  typeof m.content === "string" &&
                  !m.content.startsWith("RESULT_JSON") &&
                  !m.content.startsWith("TEST_JSON"),
              )?.content || null

            // 尝试从 accumulated 中提取分数
            let totalScore: number | null = null
            if (accumulated && typeof accumulated === "string") {
              const scoreMatch = accumulated.match(
                /(?:总分|得分|score)[：:]\s*(\d+)/i,
              )
              if (scoreMatch && scoreMatch[1]) {
                totalScore = parseInt(scoreMatch[1], 10)
              }
            }

            // 调用 API 保存记录
            TestRecordsService.createTestRecord({
              requestBody: {
                test_name: testName,
                user_topic: userTopic,
                total_score: totalScore,
                result_description: accumulated,
                questions: questions,
                answers: answers,
                conversation_id: activeConvId || undefined,
              },
            })
              .then(() => {
                // 刷新测评记录列表
                queryClient.invalidateQueries({ queryKey: ["test-records"] })
              })
              .catch((err: unknown) => {
                // 只记录错误，不影响主流程
                const message = err instanceof Error ? err.message : String(err)
                console.error("保存测评记录失败:", message)
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
            setIsStreaming(false)
            setWorkflowRunning(false)
            setSubmissionStatus("idle")
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
          conversationId: activeConvId || undefined,
          apiKey: DIFY_TEST_API_KEY,
        },
      )
    } catch (err) {
      if (!streamHandledEnd) {
        setIsStreaming(false)
        setSubmissionStatus("idle")
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

  // ── 答题进度 ────────────────────────────────────────────────────────────────
  const answeredCount = activeTest
    ? activeTest.questions.filter((q) => testAnswers[q.id] !== undefined).length
    : 0
  const totalCount = activeTest?.questions.length ?? 0
  const allAnswered = answeredCount === totalCount && totalCount > 0
  const progressPct = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-card">
      {/* ── 顶栏 ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b px-5 py-3">
        <div className={`flex size-8 items-center justify-center rounded-full ${
          isWarmTheme ? 'warm-gradient-bg warm-shadow' : 'bg-violet-100'
        }`}>
          <ClipboardList className={`size-4 ${
            isWarmTheme ? 'text-white' : 'text-violet-600'
          }`} />
        </div>
        <div>
          <h1 className="text-sm font-semibold">心理测评</h1>
          <p className="text-xs text-muted-foreground">
            专业心理量表 · AI 智能分析报告
          </p>
        </div>
      </div>

      {/* ── 主内容区 ──────────────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        {/* ── 聊天消息区域 ──────────────────────────────────────────────────── */}
        <div className="h-full overflow-y-auto px-4 py-4">
          {messages.length === 0 && !activeTest ? (
            /* 欢迎界面 */
            <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
              {/* 头像 */}
              <div className={`flex size-20 items-center justify-center rounded-full shadow-sm ${
                isWarmTheme
                  ? 'warm-gradient-bg warm-shadow-lg'
                  : 'bg-gradient-to-br from-violet-100 to-purple-100'
              }`}>
                <span className="text-3xl">🧠</span>
              </div>

              {/* 问候语 */}
              <div className="max-w-md text-center space-y-3">
                <h2 className="text-xl font-semibold">你好呀！👋✨</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  很高兴见到你！我是
                  <strong className={isWarmTheme ? 'warm-gradient-text' : 'text-violet-600'}>小心</strong>
                  ，你的心理测试小助手～
                  <br />
                  这里是一个温暖的角落，可以帮助你更好地了解自己的内心世界。
                </p>
              </div>

              {/* 三个功能卡片 */}
              <div className="w-full max-w-md space-y-3">
                {[
                  {
                    emoji: "🌟",
                    title: "聊聊心事",
                    desc: "如果你最近有什么烦心事或者想倾诉的，我可以陪你说说话",
                  },
                  {
                    emoji: "📋",
                    title: "做个心理小测试",
                    desc: "想探索一下自己的某个心理维度吗？比如情绪、压力、睡眠、人际关系等",
                  },
                  {
                    emoji: "🎯",
                    title: "了解测试怎么做",
                    desc: "如果你想了解如何使用测试功能，我可以一步步告诉你哦",
                  },
                ].map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setInputText(item.title)}
                    className={`w-full flex items-start gap-3 rounded-xl border p-4 shadow-sm transition-all cursor-pointer ${
                      isWarmTheme
                        ? 'border-primary/20 bg-white/80 hover:bg-primary/10 hover:border-primary warm-transition'
                        : 'border-violet-100 bg-white/80 hover:bg-violet-50/60 hover:border-violet-200 hover:shadow-md'
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0 mt-0.5">
                      {item.emoji}
                    </span>
                    <div className="min-w-0 text-left">
                      <div className={`text-sm font-semibold ${
                        isWarmTheme ? 'text-primary' : 'text-violet-700'
                      }`}>
                        {item.title}
                      </div>
                      <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* 消息列表 */
            <div className="mx-auto max-w-2xl space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <Avatar className="mt-0.5 size-8 flex-shrink-0">
                      <AvatarFallback className={`${
                        isWarmTheme ? 'warm-gradient-bg' : 'bg-violet-100 text-violet-600'
                      }`}>
                        <ClipboardList className={`size-4 ${
                          isWarmTheme ? 'text-white' : ''
                        }`} />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="max-w-[78%]">
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? (isWarmTheme ? 'btn-warm-primary' : 'bg-violet-600 text-white whitespace-pre-wrap')
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-table:text-sm prose-th:bg-muted prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-table:border prose-th:border prose-td:border prose-border-border">
                          {msg.isStreaming && !msg.content ? (
                            ""
                          ) : (
                            <ReactMarkdown>
                              {preprocessMarkdown(msg.content)}
                            </ReactMarkdown>
                          )}
                          {msg.isStreaming && msg.content && (
                            <span className="ml-0.5 inline-block animate-pulse text-current opacity-70">
                              |
                            </span>
                          )}
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                  {msg.role === "user" && (
                    <Avatar className="mt-0.5 size-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-xs">
                        {(user?.full_name || "U").slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {/* 思考中 loading（非 workflow 状态时才显示普通思考动画） */}
              {isStreaming &&
                !messages[messages.length - 1]?.content &&
                !activeTest &&
                !workflowRunning && (
                  <div className="flex gap-3">
                    <Avatar className="mt-0.5 size-8 flex-shrink-0">
                      <AvatarFallback className={`${
                        isWarmTheme ? 'warm-gradient-bg' : 'bg-violet-100 text-violet-600'
                      }`}>
                        <ClipboardList className={`size-4 ${
                          isWarmTheme ? 'text-white' : ''
                        }`} />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-4 py-2.5">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        思考中...
                      </span>
                    </div>
                  </div>
                )}

              {/* workflow 运行中 loading（独立状态指示器，不占消息气泡） */}
              {workflowRunning && isStreaming && (
                <div className="flex justify-center">
                  <div className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm animate-in fade-in duration-300 ${
                    isWarmTheme
                      ? 'border-primary/30 bg-primary/10 warm-shadow'
                      : 'border-violet-200 bg-violet-50'
                  }`}>
                    <Loader2 className={`size-4 animate-spin ${
                      isWarmTheme ? 'text-primary' : 'text-violet-500'
                    }`} />
                    <span className={`font-medium ${
                      isWarmTheme ? 'text-primary' : 'text-violet-600'
                    }`}>
                      AI 正在分析中，请稍候...
                    </span>
                  </div>
                </div>
              )}

              {/* 提交状态流转提示 */}
              {submissionStatus !== "idle" && (
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm shadow-sm animate-in fade-in duration-300">
                    {submissionStatus === "submitting" && (
                      <>
                        <CheckCircle2 className="size-4 text-green-500" />
                        <span className="text-green-600 font-medium">
                          提交成功
                        </span>
                      </>
                    )}
                    {submissionStatus === "analyzing" && (
                      <>
                        <Loader2 className="size-4 animate-spin text-violet-500" />
                        <span className="text-violet-600 font-medium">
                          开始分析
                        </span>
                      </>
                    )}
                    {submissionStatus === "done" && (
                      <>
                        <Info className="size-4 text-blue-500" />
                        <span className="text-blue-600 font-medium">
                          分析完成
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── 答题界面（覆盖层，从底部滑入） ──────────────────────────────── */}
        {activeTest && (
          <div className="absolute inset-0 overflow-y-auto bg-background/95 backdrop-blur-sm animate-in slide-in-from-bottom-4 duration-400">
            <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
              {/* 测试标题区 */}
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-foreground">
                  {activeTest.title}
                </h2>
                <p className="text-xs text-violet-600 font-medium">
                  {activeTest.dimension}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {activeTest.description}
                </p>
              </div>

              {/* 进度条 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>答题进度</span>
                  <span className="font-medium text-foreground">
                    {answeredCount} / {totalCount} 题
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* 题目列表 */}
              <div className="space-y-4">
                {activeTest.questions.map((question, qIdx) => {
                  const answered = testAnswers[question.id]
                  return (
                    <Card
                      key={question.id}
                      className={`p-4 transition-all duration-200 ${
                        answered !== undefined
                          ? "border-violet-200 bg-violet-50/50"
                          : ""
                      }`}
                    >
                      <p className="mb-3 text-sm font-medium leading-relaxed">
                        <span className="mr-1.5 text-violet-500 font-bold">
                          {qIdx + 1}.
                        </span>
                        {question.text}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {question.options.map((option, optIdx) => {
                          const isSelected = answered?.answer === optIdx + 1
                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() =>
                                setTestAnswers((prev) => ({
                                  ...prev,
                                  [question.id]: {
                                    answer: optIdx + 1,
                                    score: question.scores[optIdx] ?? optIdx,
                                  },
                                }))
                              }
                              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-95 ${
                                isSelected
                                  ? "border-violet-500 bg-violet-600 text-white shadow-sm"
                                  : "border-border bg-background text-foreground hover:border-violet-300 hover:bg-violet-50"
                              }`}
                            >
                              {option}
                            </button>
                          )
                        })}
                      </div>
                    </Card>
                  )
                })}
              </div>

              {/* 提交区 */}
              <div className="sticky bottom-4 flex items-center justify-between rounded-xl border bg-background/95 backdrop-blur-sm px-4 py-2 shadow-md">
                <span className="text-xs text-muted-foreground">
                  {allAnswered ? (
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" />
                      全部完成，可以提交了
                    </span>
                  ) : (
                    `还有 ${totalCount - answeredCount} 题未完成`
                  )}
                </span>
                <Button
                  size="sm"
                  disabled={!allAnswered}
                  onClick={handleTestSubmit}
                  className={`transition-all duration-200 ${allAnswered ? "animate-pulse bg-violet-600 hover:bg-violet-700 hover:animate-none" : ""}`}
                >
                  提交答案
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 输入区域（答题时隐藏） ────────────────────────────────────────────── */}
      {!activeTest && (
        <div className="border-t p-4">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-end gap-2 rounded-xl border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-violet-300 focus-within:border-violet-300 transition-all">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入您想进行的测评类型，或描述您的心理状态..."
                className="flex-1 resize-none border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                rows={1}
                disabled={isStreaming}
                style={{ maxHeight: "120px", minHeight: "24px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = "24px"
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                }}
              />
              <Button
                size="icon-sm"
                onClick={() => handleSend()}
                disabled={isStreaming || !inputText.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white flex-shrink-0"
              >
                {isStreaming ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
