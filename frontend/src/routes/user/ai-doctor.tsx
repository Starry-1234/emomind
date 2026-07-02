import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { AnimatePresence, motion } from "framer-motion"
import {
  Brain,
  FileText,
  Loader2,
  Mic,
  Send,
  Square,
  Video,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { AnalysisReportsService } from "@/client"
import { MessageActions } from "@/components/chat/MessageActions"
import { StreamingMessage } from "@/components/chat/StreamingMessage"
import { Button } from "@/components/ui/button"
import { useConversation } from "@/contexts/ConversationContext"
import useAuth from "@/hooks/useAuth"
import { useChat } from "@/hooks/useChat"
import { useCurrentTheme } from "@/hooks/useCurrentTheme"
import { sendChatStream } from "@/services/langgraphApi"
import type {
  LangGraphMessage,
  StreamCallbacks,
} from "@/services/langgraphTypes"

// TODO(M5): uploadFile() + the Dify-shaped `inputs`/`files` payload below
// belong to the deleted difyApi. Replace with a Spring /files upload
// helper and langgraphApi-shaped input once M5 rewrites this route.

// Local stub so the call site still type-checks. Throws at runtime;
// the analysis modal is gated behind M2/Qwen3-Omni work anyway.
async function uploadFile(
  _file: File,
  _userId: string,
  _category: string,
): Promise<{ id: string }> {
  throw new Error(
    "uploadFile() not implemented — awaits M2 (Qwen3-Omni + Spring /api/v1/ai/files)",
  )
}

export const Route = createFileRoute("/user/ai-doctor")({
  component: AiDoctorLayout,
  head: () => ({
    meta: [{ title: "智能心理医生" }],
  }),
})

function AiDoctorLayout() {
  return <Outlet />
}

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
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
      <span className="text-sm text-muted-foreground">医者研墨中…</span>
    </div>
  )
}

/* ── 消息进场动画变体 ─────────────────────────────── */

const userMessageTransition = { duration: 0.4, ease: "easeInOut" as const }
const assistantMessageTransition = { duration: 0.4, ease: "easeInOut" as const }

/* ── Page ──────────────────────────────────────────── */

export function AiDoctor({ sessionId: propSessionId }: { sessionId?: string }) {
  const { user } = useAuth()
  const userId = user?.id || "anonymous"
  const {
    activeConvId,
    setActiveConvId,
    loadConversations,
    selectConversationById,
  } = useConversation()
  useCurrentTheme() // keep hook for theme side-effects
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
        navigate({ to: "/user/ai-doctor", replace: true })
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
    selectConversationById(conversationId, "ai-doctor")
    loadConversations()
    if (isMountedRef.current) {
      navigate({
        to: "/user/ai-doctor/chat/$sessionId",
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
    attachedFiles,
    messagesEndRef,
    handleSend,
    handleStop,
    handleContinue,
    handleRegenerate,
    handleSwitchVersion,
    handleKeyDown,
    categorizeFile,
    removeAttachment,
  } = useChat(
    userId,
    effectiveSessionId,
    setActiveConvId,
    loadConversations,
    handleSessionCreated,
    "ai-doctor",
  )

  // 基础路由安全网
  useEffect(() => {
    if (!propSessionId && messages.length > 0) {
      const hasStreaming = messages.some((m) => m.isStreaming)
      if (!hasStreaming) {
        setMessages([])
      }
    }
  }, [propSessionId, messages.length, messages, setMessages])

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
  }, [messages, messagesEndRef.current])

  // UI refs
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const analysisFileRef = useRef<HTMLInputElement>(null)
  const analysisAbortControllerRef = useRef<AbortController | null>(null)

  // 分析模态框状态
  const [showAnalysisUpload, setShowAnalysisUpload] = useState(false)
  const [analysisFiles, setAnalysisFiles] = useState<File[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // 文件图标
  const getFileIcon = (file: File) => {
    if (file.type.startsWith("audio"))
      return <Mic className="size-4 text-[#8b5e4a]" />
    if (file.type.startsWith("video"))
      return <Video className="size-4 text-[#5a7a6a]" />
    return <FileText className="size-4 text-[#6b6b6b]" />
  }

  // 组件卸载时中止正在进行的分析
  useEffect(() => {
    return () => {
      analysisAbortControllerRef.current?.abort()
      analysisAbortControllerRef.current = null
    }
  }, [])

  // 开场白
  const openingStatement =
    "您好，我是您专属的心理医生朋友。\n\n您可以上传音频、视频或文档，让我帮您分析心理状况；也可以输入「智能问答」，让我为您生成心理测试题目。"

  return (
    <div className="flex h-full gap-4 p-4">
      {/* 聊天区域 */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
        {/* ── 顶栏 ── */}
        <div className="shrink-0 flex items-center gap-3 border-b px-5 py-3">
          {/* 印章图标 */}
          <div className="flex size-8 items-center justify-center rounded border-2 border-primary/80">
            <span className="font-serif-zh text-sm font-bold text-primary">
              医
            </span>
          </div>
          <div>
            <h1 className="font-serif-zh text-sm font-semibold">
              智能心理医生
            </h1>
            <p className="text-xs text-muted-foreground">多模态心理状况分析</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#5a7a6a]" />
            <span className="text-[11px] text-muted-foreground">在线</span>
          </div>
        </div>

        {/* ── 消息区域 ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <motion.div
              className="flex h-full flex-col items-center justify-center gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* 欢迎信笺 */}
              <div className="relative w-full max-w-lg">
                <div className="rounded-lg border bg-card p-8 shadow-sm">
                  {/* 顶部装饰线 */}
                  <div className="mb-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="font-serif-zh text-xs tracking-widest text-muted-foreground">
                      展信安
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="space-y-4 text-sm leading-relaxed text-foreground">
                    {openingStatement
                      .split("\n")
                      .map((line, i) =>
                        line ? (
                          <p key={i}>{line}</p>
                        ) : (
                          <div key={i} className="h-2" />
                        ),
                      )}
                  </div>

                  {/* 底部印章 */}
                  <div className="mt-6 flex justify-end">
                    <div className="flex size-10 items-center justify-center rounded border-2 border-accent/70">
                      <span className="font-serif-zh text-xs font-bold text-accent">
                        医
                      </span>
                    </div>
                  </div>
                </div>
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
                    className={`flex items-start gap-2 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="text-[10px] text-muted-foreground pt-2">
                        医者曰
                      </div>
                    )}
                    <div
                      className={`space-y-1.5 ${
                        msg.role === "user"
                          ? "max-w-[80%] items-end"
                          : "flex-1 items-start"
                      }`}
                    >
                      {/* 消息文件 */}
                      {msg.files && msg.files.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-1">
                          {msg.files.map((f) => (
                            <div
                              key={f.id}
                              className="text-xs text-muted-foreground"
                            >
                              {f.type === "image" ? (
                                <img
                                  src={f.url}
                                  alt="附件"
                                  className="max-h-48 rounded-md border"
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded border bg-background px-2 py-1">
                                  <FileText className="size-3" />
                                  文件
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 消息内容 */}
                      {msg.role === "user" ? (
                        <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground leading-relaxed shadow-sm">
                          {msg.content || (msg.isStreaming ? "" : "...")}
                        </div>
                      ) : (
                        <div className="relative w-full rounded-lg rounded-tl-sm border border-border bg-card px-5 py-4 text-sm text-card-foreground shadow-sm">
                          <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary/30 rounded-full" />
                          {(() => {
                            const cleaned = (msg.content || "")
                              .replace(/^正在分析中，请稍候...\n?/, "")
                              .replace(/^思考中...\n?/, "")
                            if (msg.isStreaming && !cleaned) {
                              return (
                                <div className="pl-3">
                                  <InkGrinding />
                                </div>
                              )
                            }
                            if (msg.isStreaming) {
                              return (
                                <StreamingMessage
                                  content={cleaned}
                                  isStreaming={msg.isStreaming}
                                  className="pl-3 prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-card-foreground prose-headings:text-card-foreground prose-a:text-primary"
                                />
                              )
                            }
                            return (
                              <div className="pl-3 prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-card-foreground prose-headings:text-card-foreground prose-a:text-primary">
                                <ReactMarkdown>{cleaned}</ReactMarkdown>
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      {/* 操作按钮 / 时间戳 */}
                      {msg.role === "assistant" && (
                        <>
                          {!msg.isStreaming && (
                            <div className="px-1 text-[10px] text-muted-foreground">
                              {formatTime(Date.now() / 1000)}
                            </div>
                          )}
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
                        </>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="text-[10px] text-muted-foreground pt-2">
                        我问
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* 研墨中指示器 */}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── 输入区域 —— 书写台 ── */}
        <div className="shrink-0 border-t bg-background/80 backdrop-blur-sm px-4 py-4">
          <div className="mx-auto max-w-3xl">
            {/* 附件预览 */}
            <AnimatePresence>
              {attachedFiles.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3 flex flex-wrap gap-2"
                >
                  {attachedFiles.map((file, idx) => {
                    const isImage = file.type.startsWith("image")
                    const previewUrl = isImage
                      ? URL.createObjectURL(file)
                      : null
                    return (
                      <motion.div
                        key={`${file.name}-${idx}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="group relative flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs"
                      >
                        {isImage && previewUrl ? (
                          <div className="size-8 overflow-hidden rounded-md">
                            <img
                              src={previewUrl}
                              alt={file.name}
                              className="size-full object-cover"
                              onLoad={() => URL.revokeObjectURL(previewUrl)}
                            />
                          </div>
                        ) : (
                          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
                            {getFileIcon(file)}
                          </div>
                        )}
                        {!isImage && (
                          <span className="max-w-[120px] truncate text-xs">
                            {file.name}
                          </span>
                        )}
                        <button
                          type="button"
                          className="rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10"
                          onClick={() => {
                            removeAttachment(idx)
                            if (previewUrl) URL.revokeObjectURL(previewUrl)
                          }}
                        >
                          <X className="size-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 输入框 */}
            <div className="relative flex items-end gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-colors focus-within:border-primary/40 focus-within:shadow-md">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAnalysisUpload(true)}
                  disabled={isStreaming}
                >
                  <Brain className="size-4 mr-1" />
                  <span className="text-xs">分析</span>
                </Button>
              </div>

              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="在此书写您的心事…"
                className="min-h-[24px] flex-1 resize-none border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 placeholder:italic"
                rows={1}
                disabled={isStreaming}
                style={{ maxHeight: "120px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = "24px"
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                }}
              />

              <Button
                size="icon-sm"
                className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 shrink-0"
                onClick={() => {
                  if (isAnalyzing) {
                    analysisAbortControllerRef.current?.abort()
                    analysisAbortControllerRef.current = null
                    setIsAnalyzing(false)
                    sessionStorage.removeItem("ai-doctor_streaming")
                    setMessages((prev) => {
                      const newMsgs = [...prev]
                      const last = newMsgs[newMsgs.length - 1]
                      if (last?.isStreaming) {
                        newMsgs[newMsgs.length - 1] = {
                          ...last,
                          isStreaming: false,
                        }
                      }
                      return newMsgs
                    })
                  } else if (isStreaming) {
                    handleStop()
                  } else {
                    handleSend()
                  }
                }}
                disabled={
                  !isAnalyzing &&
                  !isStreaming &&
                  !inputText.trim() &&
                  attachedFiles.length === 0
                }
              >
                {isAnalyzing || isStreaming ? (
                  <Square className="size-3.5 fill-current" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 心理状况分析 - 文件上传模态框 ── */}
      {showAnalysisUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            type="button"
            aria-label="关闭对话框"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              analysisAbortControllerRef.current?.abort()
              analysisAbortControllerRef.current = null
              setShowAnalysisUpload(false)
              setAnalysisFiles([])
              setIsAnalyzing(false)
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 w-full max-w-md rounded-xl bg-card p-6 shadow-2xl border"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif-zh text-lg font-semibold">
                心理状况分析
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  analysisAbortControllerRef.current?.abort()
                  analysisAbortControllerRef.current = null
                  setShowAnalysisUpload(false)
                  setAnalysisFiles([])
                  setIsAnalyzing(false)
                }}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mb-4">
              <input
                ref={analysisFileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.md,audio/*,video/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  if (files.length > 0) {
                    setAnalysisFiles((prev) => [...prev, ...files])
                  }
                }}
              />

              {analysisFiles.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-3">
                    选择要分析的档案类型：
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (analysisFileRef.current) {
                          analysisFileRef.current.accept =
                            ".pdf,.doc,.docx,.txt,.md"
                          analysisFileRef.current.click()
                        }
                      }}
                      className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border/60 p-4 transition-all hover:border-primary hover:bg-primary/5"
                    >
                      <FileText className="size-8 text-muted-foreground" />
                      <span className="text-sm font-medium">文档</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (analysisFileRef.current) {
                          analysisFileRef.current.accept = "audio/*"
                          analysisFileRef.current.click()
                        }
                      }}
                      className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border/60 p-4 transition-all hover:border-primary hover:bg-primary/5"
                    >
                      <Mic className="size-8 text-muted-foreground" />
                      <span className="text-sm font-medium">音频</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (analysisFileRef.current) {
                          analysisFileRef.current.accept = "video/*"
                          analysisFileRef.current.click()
                        }
                      }}
                      className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border/60 p-4 transition-all hover:border-primary hover:bg-primary/5"
                    >
                      <Video className="size-8 text-muted-foreground" />
                      <span className="text-sm font-medium">视频</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-3">
                    已选择的文件（可继续添加）：
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {analysisFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="rounded-lg border bg-muted/30 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                            {file.type.startsWith("audio") ? (
                              <Mic className="size-4 text-[#8b5e4a]" />
                            ) : file.type.startsWith("video") ? (
                              <Video className="size-4 text-[#5a7a6a]" />
                            ) : (
                              <FileText className="size-4 text-[#6b6b6b]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setAnalysisFiles((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            className="rounded-full p-1 hover:bg-destructive/10"
                          >
                            <X className="size-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (analysisFileRef.current) {
                          analysisFileRef.current.accept =
                            ".pdf,.doc,.docx,.txt,.md"
                          analysisFileRef.current.click()
                        }
                      }}
                      className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-border/60 p-2 transition-all hover:border-primary hover:bg-primary/5"
                    >
                      <FileText className="size-5 text-muted-foreground" />
                      <span className="text-xs font-medium">+ 文档</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (analysisFileRef.current) {
                          analysisFileRef.current.accept = "audio/*"
                          analysisFileRef.current.click()
                        }
                      }}
                      className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-border/60 p-2 transition-all hover:border-primary hover:bg-primary/5"
                    >
                      <Mic className="size-5 text-muted-foreground" />
                      <span className="text-xs font-medium">+ 音频</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (analysisFileRef.current) {
                          analysisFileRef.current.accept = "video/*"
                          analysisFileRef.current.click()
                        }
                      }}
                      className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-border/60 p-2 transition-all hover:border-primary hover:bg-primary/5"
                    >
                      <Video className="size-5 text-muted-foreground" />
                      <span className="text-xs font-medium">+ 视频</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              disabled={analysisFiles.length === 0 || isAnalyzing}
              onClick={async () => {
                if (analysisFiles.length === 0) return
                setIsAnalyzing(true)
                setShowAnalysisUpload(false)

                let accumulated = ""
                let streamHandledEnd = false

                try {
                  const abortController = new AbortController()
                  analysisAbortControllerRef.current = abortController

                  // TODO(M5): uploadFile() came from the deleted difyApi.
                  // M2/Qwen3-Omni path will replace this with a real
                  // Spring /api/v1/ai/files upload + multimodal graph call.
                  const uploadResults = await Promise.all(
                    analysisFiles.map((file) =>
                      uploadFile(file, userId, "ai-doctor"),
                    ),
                  )

                  const fileCategories = analysisFiles.map((f) =>
                    categorizeFile(f),
                  )
                  const fileNames = analysisFiles.map((f) => f.name).join("、")
                  const categoryLabels = fileCategories.map((c) =>
                    c === "audio" ? "音频" : c === "video" ? "视频" : "文档",
                  )

                  const userMsg: LangGraphMessage = {
                    role: "user",
                    content: `【心理状况分析】上传了 ${analysisFiles.length} 个文件（${categoryLabels.join("、")}）：${fileNames}`,
                  }
                  setMessages((prev) => [...prev, userMsg])

                  const assistantMsg: LangGraphMessage = {
                    role: "assistant",
                    content: "",
                    isStreaming: true,
                  }
                  setMessages((prev) => [...prev, assistantMsg])

                  // TODO(M5): the Dify-shaped `inputs` blob (video/audio/text
                  // split) was passed to difyApi.sendMessageStream. The new
                  // langgraphApi takes LangGraphMessage[]; the multimodal
                  // mapping lands in M2 (Qwen3-Omni path).
                  const allFileData = uploadResults.map((result, idx) => ({
                    type:
                      fileCategories[idx] === "audio"
                        ? "audio"
                        : fileCategories[idx] === "video"
                          ? "video"
                          : "document",
                    transfer_method: "local_file" as const,
                    url: result.id,
                    upload_file_id: result.id,
                  }))

                  const inputs: Record<string, unknown> = {
                    video: allFileData.find((f) => f.type === "video"),
                    audio: allFileData.find((f) => f.type === "audio"),
                    text: allFileData.find((f) => f.type === "document"),
                    userinput: {
                      query:
                        "请你对我上传的档案文件进行专业心理状况分析，给出详细的分析报告。",
                      files: [],
                    },
                  }

                  const filesToSend = allFileData

                  // TODO(M5): below is a thin shim from the old Dify
                  // callback shape (onWorkflowStarted/onMessage/onMessageEnd)
                  // to the new StreamCallbacks (onNodeStart/onToken/
                  // onMessageEnd). M5 will rewrite the analysis modal in full
                  // once /api/v1/ai/files exists.
                  const streamCallbacks: StreamCallbacks = {
                    onNodeStart(_nodeName) {
                      setMessages((prev) => {
                        const newMsgs = [...prev]
                        const last = newMsgs[newMsgs.length - 1]
                        if (last?.isStreaming) {
                          newMsgs[newMsgs.length - 1] = {
                            ...last,
                            content: "正在分析中，请稍候...\n",
                          }
                        }
                        return newMsgs
                      })
                      accumulated = "正在分析中，请稍候...\n"
                    },
                    onToken(delta) {
                      accumulated += delta
                      if (
                        accumulated.startsWith("正在分析中，请稍候...\n") &&
                        delta.trim().length > 0
                      ) {
                        accumulated = accumulated.replace(
                          /^正在分析中，请稍候...\n?/,
                          "",
                        )
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
                    onMessageEnd(threadId, _runId, _fullContent) {
                      streamHandledEnd = true
                      setIsAnalyzing(false)
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

                      const actualAnalysisResult = accumulated
                        .replace(/^正在分析中，请稍候...\n?/, "")
                        .trim()
                      const reportData = {
                        file_name: analysisFiles.map((f) => f.name).join(", "),
                        file_type: "multi",
                        file_size: analysisFiles.reduce(
                          (sum, f) => sum + f.size,
                          0,
                        ),
                        analysis_result: actualAnalysisResult,
                        conversation_id: threadId || activeConvId || undefined,
                      }
                      AnalysisReportsService.createReport1({
                        requestBody: reportData,
                      })
                        .then((result) => {
                          console.log("保存分析报告成功:", result)
                        })
                        .catch((err) => {
                          console.error("保存分析报告到数据库失败，错误:", err)
                        })

                      if (threadId) {
                        selectConversationById(threadId, "ai-doctor")
                        loadConversations()
                        if (isMountedRef.current) {
                          navigate({
                            to: "/user/ai-doctor/chat/$sessionId",
                            params: { sessionId: threadId },
                            replace: true,
                          })
                        }
                      }
                      loadConversations()
                    },
                    onError(_code, message, _recoverable) {
                      streamHandledEnd = true
                      setIsAnalyzing(false)
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
                  }

                  await sendChatStream(
                    "ai-doctor",
                    {
                      messages: [userMsg],
                      files: filesToSend,
                    },
                    streamCallbacks,
                    {
                      threadId: effectiveSessionId || undefined,
                      signal: abortController.signal,
                    },
                  )
                  // Silence unused-locals warnings for fields kept for
                  // future M5 wiring.
                  void inputs
                } catch (err) {
                  if (!streamHandledEnd) {
                    setIsAnalyzing(false)
                    setMessages((prev) => {
                      const newMsgs = [...prev]
                      const last = newMsgs[newMsgs.length - 1]
                      if (last?.isStreaming) {
                        newMsgs[newMsgs.length - 1] = {
                          ...last,
                          content: `分析失败: ${err instanceof Error ? err.message : "未知错误"}`,
                          isStreaming: false,
                        }
                      }
                      return newMsgs
                    })
                  }
                }

                setAnalysisFiles([])
              }}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  斟酌中…
                </>
              ) : (
                "开始分析"
              )}
            </Button>

            {isAnalyzing && (
              <div className="mt-3 text-center text-sm text-muted-foreground">
                医者正在品读档案，请稍候…
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  )
}
