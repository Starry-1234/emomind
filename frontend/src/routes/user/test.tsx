import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import {
  CheckCircle2,
  ClipboardList,
  Info,
  Loader2,
  Send,
  Square,
} from "lucide-react"
import { useEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
import { useConversation } from "@/components/contexts/ConversationContext"
import { MessageActions } from "@/components/MessageActions"
import { StreamingMessage } from "@/components/StreamingMessage"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"
import { useCurrentTheme } from "@/hooks/useCurrentTheme"
import { usePsychologicalTest } from "@/hooks/usePsychologicalTest"

export const Route = createFileRoute("/user/test")({
  component: TestLayout,
  head: () => ({
    meta: [{ title: "心理测评" }],
  }),
})

function TestLayout() {
  return <Outlet />
}

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
    if (line.includes("\t")) {
      const buffer: string[] = []
      while (i < lines.length && lines[i]?.includes("\t")) {
        buffer.push(lines[i])
        i++
      }
      if (buffer.length >= 2) {
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

export function PsychologicalTestInner({
  sessionId: propSessionId,
}: {
  sessionId?: string
}) {
  const { user } = useAuth()
  const userId = user?.id || "anonymous"
  const {
    activeConvId,
    setActiveConvId,
    loadConversations,
    selectConversationById,
  } = useConversation()
  const { isWarmTheme } = useCurrentTheme()
  const navigate = useNavigate()

  // 挂载状态跟踪
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // ── 同步 URL sessionId 和 Context activeConvId ─────────────────────────────
  const hadActiveIdRef = useRef(false)

  useEffect(() => {
    if (propSessionId && propSessionId !== activeConvId) {
      if (activeConvId === "" && hadActiveIdRef.current) {
        navigate({ to: "/user/test", replace: true })
        return
      }
      setActiveConvId(propSessionId)
    }

    if (activeConvId) {
      hadActiveIdRef.current = true
    }
  }, [propSessionId, activeConvId, setActiveConvId, navigate])

  // 基础路由（propSessionId 为 undefined）时用空字符串
  const effectiveSessionId = propSessionId ?? ""

  // 新会话创建回调
  const handleSessionCreated = (conversationId: string) => {
    // 用 selectConversationById 确保写到正确模块，避免 currentContext 竞态
    selectConversationById(conversationId, "test")
    loadConversations()
    if (isMountedRef.current) {
      navigate({
        to: "/user/test/chat/$sessionId",
        params: { sessionId: conversationId },
        replace: true,
      })
    }
  }

  const {
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
  } = usePsychologicalTest(
    userId,
    effectiveSessionId,
    setActiveConvId,
    loadConversations,
    handleSessionCreated,
  )

  // ── 基础路由安全网：确保没有 stale 消息残留 ──────────────────────────────
  useEffect(() => {
    if (!propSessionId && messages.length > 0) {
      const hasStreaming = messages.some((m) => m.isStreaming)
      if (!hasStreaming) {
        setMessages([])
        setActiveTest(null)
        setTestAnswers({})
      }
    }
  }, [
    propSessionId,
    messages.length,
    setActiveTest,
    setMessages,
    messages,
    setTestAnswers,
  ])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-card">
      {/* 顶栏 */}
      <div className="flex items-center gap-3 border-b px-5 py-3">
        <div
          className={`flex size-8 items-center justify-center rounded-full ${
            isWarmTheme ? "warm-gradient-bg warm-shadow" : "bg-violet-100"
          }`}
        >
          <ClipboardList
            className={`size-4 ${
              isWarmTheme ? "text-white" : "text-violet-600"
            }`}
          />
        </div>
        <div>
          <h1 className="text-sm font-semibold">心理测评</h1>
          <p className="text-xs text-muted-foreground">
            专业心理量表 · AI 智能分析报告
          </p>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="relative flex-1 overflow-hidden">
        {/* 聊天消息区域 */}
        <div className="h-full overflow-y-auto px-4 py-4">
          {messages.length === 0 && !activeTest ? (
            /* 欢迎界面 */
            <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
              <div
                className={`flex size-20 items-center justify-center rounded-full shadow-sm ${
                  isWarmTheme
                    ? "warm-gradient-bg warm-shadow-lg"
                    : "bg-gradient-to-br from-violet-100 to-purple-100"
                }`}
              >
                <span className="text-3xl">🧠</span>
              </div>

              <div className="max-w-md text-center space-y-3">
                <h2 className="text-xl font-semibold">你好呀！👋✨</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  很高兴见到你！我是
                  <strong
                    className={
                      isWarmTheme ? "warm-gradient-text" : "text-violet-600"
                    }
                  >
                    小心
                  </strong>
                  ，你的心理测试小助手～
                  <br />
                  这里是一个温暖的角落，可以帮助你更好地了解自己的内心世界。
                </p>
              </div>

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
                        ? "border-primary/20 bg-white/80 hover:bg-primary/10 hover:border-primary warm-transition"
                        : "border-violet-100 bg-white/80 hover:bg-violet-50/60 hover:border-violet-200 hover:shadow-md"
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0 mt-0.5">
                      {item.emoji}
                    </span>
                    <div className="min-w-0 text-left">
                      <div
                        className={`text-sm font-semibold ${
                          isWarmTheme ? "text-primary" : "text-violet-700"
                        }`}
                      >
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
                      <AvatarFallback
                        className={`${
                          isWarmTheme
                            ? "warm-gradient-bg"
                            : "bg-violet-100 text-violet-600"
                        }`}
                      >
                        <ClipboardList
                          className={`size-4 ${
                            isWarmTheme ? "text-white" : ""
                          }`}
                        />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="max-w-[78%]">
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? isWarmTheme
                            ? "btn-warm-primary"
                            : "bg-violet-600 text-white whitespace-pre-wrap"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        msg.isStreaming ? (
                          <StreamingMessage
                            content={msg.content || ""}
                            isStreaming={msg.isStreaming}
                            className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-table:text-sm prose-th:bg-muted prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-table:border prose-th:border prose-td:border prose-border-border"
                          />
                        ) : (
                          <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-table:text-sm prose-th:bg-muted prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-table:border prose-th:border prose-td:border prose-border-border">
                            <ReactMarkdown>
                              {preprocessMarkdown(msg.content)}
                            </ReactMarkdown>
                          </div>
                        )
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.role === "assistant" && (
                      <MessageActions
                        isPaused={msg.isPaused || false}
                        isStreaming={msg.isStreaming || false}
                        versions={msg.versions}
                        currentVersion={msg.currentVersion}
                        onContinue={() => handleContinue(idx)}
                        onCopy={() =>
                          navigator.clipboard.writeText(msg.content)
                        }
                        onRegenerate={() => handleRegenerate(idx)}
                        onSwitchVersion={(direction) =>
                          handleSwitchVersion(idx, direction)
                        }
                        disabled={isStreaming}
                      />
                    )}
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

              {/* 思考中 loading */}
              {isStreaming &&
                !messages.some(
                  (m) => m.role === "assistant" && m.isStreaming && m.content,
                ) &&
                !activeTest &&
                !workflowRunning && (
                  <div className="flex gap-3">
                    <Avatar className="mt-0.5 size-8 flex-shrink-0">
                      <AvatarFallback
                        className={`${
                          isWarmTheme
                            ? "warm-gradient-bg"
                            : "bg-violet-100 text-violet-600"
                        }`}
                      >
                        <ClipboardList
                          className={`size-4 ${
                            isWarmTheme ? "text-white" : ""
                          }`}
                        />
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

              {/* workflow 运行中 */}
              {workflowRunning && isStreaming && (
                <div className="flex justify-center">
                  <div
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm animate-in fade-in duration-300 ${
                      isWarmTheme
                        ? "border-primary/30 bg-primary/10 warm-shadow"
                        : "border-violet-200 bg-violet-50"
                    }`}
                  >
                    <Loader2
                      className={`size-4 animate-spin ${
                        isWarmTheme ? "text-primary" : "text-violet-500"
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        isWarmTheme ? "text-primary" : "text-violet-600"
                      }`}
                    >
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

        {/* 答题界面（覆盖层） */}
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

      {/* 输入区域（答题时隐藏） */}
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
                onClick={() => (isStreaming ? handleStop() : handleSend())}
                disabled={!isStreaming && !inputText.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white flex-shrink-0"
              >
                {isStreaming ? (
                  <Square className="size-4 fill-current" />
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
