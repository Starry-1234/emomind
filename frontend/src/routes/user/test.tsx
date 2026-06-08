import { motion, AnimatePresence } from "framer-motion"
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
import { MessageActions } from "@/components/chat/MessageActions"
import { StreamingMessage } from "@/components/chat/StreamingMessage"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useConversation } from "@/contexts/ConversationContext"
import useAuth from "@/hooks/useAuth"
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

/* ── 研墨动画 ────────────────────────────────────── */

function InkGrinding() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="size-2 rounded-full bg-primary/40"
            animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0.7, 0.3] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.25,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">研墨中</span>
    </div>
  )
}

/* ── 消息进场动画 ─────────────────────────────────── */

const userMessageTransition = { duration: 0.4, ease: "easeInOut" as const }
const assistantMessageTransition = { duration: 0.4, ease: "easeInOut" as const }

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

  const effectiveSessionId = propSessionId ?? ""

  const handleSessionCreated = (conversationId: string) => {
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

  // 用户发送消息后自动滚动到底部
  const prevMessagesLength = useRef(0)
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      const added = messages.slice(prevMessagesLength.current)
      if (added.some((m) => m.role === "user")) {
        messagesEndRef.current?.scrollIntoView({ block: "end" })
      }
    }
    prevMessagesLength.current = messages.length
  }, [messages])

  // ── 基础路由安全网 ──────────────────────────────────────────────────────
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
      <div className="shrink-0 flex items-center gap-3 border-b px-5 py-3">
        <div className="flex size-8 items-center justify-center rounded border-2 border-primary/80">
          <span className="font-serif-zh text-sm font-bold text-primary">测</span>
        </div>
        <div>
          <h1 className="font-serif-zh text-sm font-semibold">心理测评</h1>
          <p className="text-xs text-muted-foreground">专业心理量表 · AI 智能分析报告</p>
        </div>
      </div>

      {/* 聊天消息区域 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !activeTest ? (
          <motion.div
            className="flex h-full flex-col items-center justify-center gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* 欢迎信笺 */}
            <div className="relative w-full max-w-lg">
              <div className="rounded-lg border bg-[#fdfcfa] p-8 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="font-serif-zh text-xs tracking-widest text-muted-foreground">
                    展信安
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="space-y-4 text-sm leading-relaxed text-foreground">
                  <p>你好呀！我是你的心理测试小助手。这里是一个温暖的角落，可以帮助你更好地了解自己的内心世界。👋</p>
                  <p>你可以直接输入想聊的话题，或者点击下方快捷入口开始。</p>
                </div>

                <div className="mt-6 flex justify-end">
                  <div className="flex size-10 items-center justify-center rounded border-2 border-accent/70">
                    <span className="font-serif-zh text-xs font-bold text-accent">
                      测
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full max-w-md space-y-3">
              {[
                {
                  title: "聊聊心事",
                  desc: "如果你最近有什么烦心事或者想倾诉的，我可以陪你说说话",
                },
                {
                  title: "做个心理小测试",
                  desc: "想探索一下自己的某个心理维度吗？比如情绪、压力、睡眠、人际关系等",
                },
                {
                  title: "了解测试怎么做",
                  desc: "如果你想了解如何使用测试功能，我可以一步步告诉你哦",
                },
              ].map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setInputText(item.title)}
                  className="w-full flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02]"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary mt-0.5">
                    <ClipboardList className="size-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="text-sm font-semibold text-foreground">
                      {item.title}
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      {item.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={
                    msg.role === "user"
                      ? { opacity: 0, x: 30, scale: 0.97 }
                      : { opacity: 0, x: -30, scale: 0.97 }
                  }
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={
                    msg.role === "user"
                      ? userMessageTransition
                      : assistantMessageTransition
                  }
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] space-y-1.5 ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    {/* 时间戳 */}
                    {msg.role === "assistant" && !msg.isStreaming && (
                      <div className="px-1 text-[10px] text-muted-foreground">
                        医生 · {new Date().toLocaleDateString("zh-CN")}
                      </div>
                    )}

                    {/* 消息内容 */}
                    <div
                      className={`relative text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "rounded-2xl rounded-tr-sm bg-[#f5f0e6] dark:bg-[#2a2a28] px-4 py-3 text-foreground border border-border/50 dark:border-white/10"
                          : "rounded-lg rounded-tl-sm border-l-[3px] border-primary bg-background px-5 py-4 text-foreground shadow-sm"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        msg.isStreaming ? (
                          <StreamingMessage
                            content={msg.content || ""}
                            isStreaming={msg.isStreaming}
                            className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-table:text-sm prose-th:bg-muted prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-table:border prose-th:border prose-td:border prose-border-border"
                          />
                        ) : (
                          <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-table:text-sm prose-th:bg-muted prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-table:border prose-th:border prose-td:border prose-border-border">
                            <ReactMarkdown>
                              {preprocessMarkdown(msg.content)}
                            </ReactMarkdown>
                          </div>
                        )
                      ) : (
                        msg.content
                      )}
                    </div>

                    {/* 操作按钮 */}
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

                    {/* 用户小印章 */}
                    {msg.role === "user" && (
                      <div className="flex justify-end px-1">
                        <span className="text-[10px] text-muted-foreground/60">
                          我
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* 研墨中 */}
            {isStreaming &&
              !messages.some(
                (m) => m.role === "assistant" && m.isStreaming && m.content,
              ) &&
              !activeTest &&
              !workflowRunning && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3"
                >
                  <div className="flex size-8 items-center justify-center rounded border border-primary/30 bg-primary/5">
                    <span className="font-serif-zh text-xs font-bold text-primary">
                      测
                    </span>
                  </div>
                  <div className="rounded-lg border-l-[3px] border-primary bg-background px-5 py-3 shadow-sm">
                    <InkGrinding />
                  </div>
                </motion.div>
              )}

            {/* workflow 运行中 */}
            {workflowRunning && isStreaming && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span className="font-medium text-primary">
                    AI 正在分析中，请稍候...
                  </span>
                </div>
              </div>
            )}

            {/* 提交状态流转提示 */}
            {submissionStatus !== "idle" && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm shadow-sm">
                  {submissionStatus === "submitting" && (
                    <>
                      <CheckCircle2 className="size-4 text-[#5a7a6a]" />
                      <span className="text-[#5a7a6a] font-medium">
                        提交成功
                      </span>
                    </>
                  )}
                  {submissionStatus === "analyzing" && (
                    <>
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span className="text-primary font-medium">开始分析</span>
                    </>
                  )}
                  {submissionStatus === "done" && (
                    <>
                      <Info className="size-4 text-[#8b7355]" />
                      <span className="text-[#8b7355] font-medium">分析完成</span>
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
        <div className="absolute inset-0 overflow-y-auto bg-background/95 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
            {/* 测试标题区 */}
            <div className="space-y-1">
              <h2 className="font-serif-zh text-xl font-bold text-foreground">
                {activeTest.title}
              </h2>
              <p className="text-xs text-primary font-medium">
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
                  className="h-full rounded-full bg-primary transition-all duration-500"
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
                        ? "border-primary/20 bg-primary/[0.02]"
                        : ""
                    }`}
                  >
                    <p className="mb-3 text-sm font-medium leading-relaxed">
                      <span className="mr-1.5 text-primary font-bold">
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
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/[0.02]"
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
                  <span className="text-[#5a7a6a] font-medium flex items-center gap-1">
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
                className={`transition-all duration-200 ${
                  allAnswered
                    ? "bg-primary hover:bg-primary/90"
                    : ""
                }`}
              >
                提交答案
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 输入区域（答题时隐藏） */}
      {!activeTest && (
        <div className="shrink-0 border-t bg-background/80 backdrop-blur-sm px-4 py-4">
          <div className="mx-auto max-w-3xl">
            <div className="relative flex items-end gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-colors focus-within:border-primary/40 focus-within:shadow-md">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="在此书写您想进行的测评类型..."
                className="min-h-[24px] flex-1 resize-none border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 placeholder:italic"
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
                className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 shrink-0"
              >
                {isStreaming ? (
                  <Square className="size-3.5 fill-current" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
