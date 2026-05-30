import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import {
  Brain,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Square,
  Stethoscope,
  Video,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { AnalysisService } from "@/client"
import { MessageActions } from "@/components/chat/MessageActions"
import { StreamingMessage } from "@/components/chat/StreamingMessage"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useConversation } from "@/contexts/ConversationContext"
import useAuth from "@/hooks/useAuth"
import { useChat } from "@/hooks/useChat"
import { useCurrentTheme } from "@/hooks/useCurrentTheme"
import { sendMessageStream, uploadFile } from "@/services/difyApi"

export const Route = createFileRoute("/user/ai-doctor")({
  component: AiDoctorLayout,
  head: () => ({
    meta: [{ title: "智能心理医生" }],
  }),
})

function AiDoctorLayout() {
  return <Outlet />
}

export function AiDoctor({ sessionId: propSessionId }: { sessionId?: string }) {
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
      // 如果 activeConvId 曾被设为非空后又变空（404 导致），且 propSessionId 是真实 ID
      // → 该会话不存在，导航离开过时 URL
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

  // 基础路由（propSessionId 为 undefined）时用空字符串，表示"新对话"模式
  const effectiveSessionId = propSessionId ?? ""

  // 新会话创建回调：仅当组件仍挂载时导航
  const handleSessionCreated = (conversationId: string) => {
    // 用 selectConversationById 确保写到正确模块，避免 currentContext 竞态
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
    handleFileSelect,
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

  // ── 基础路由安全网：确保没有 stale 消息残留 ──────────────────────────────
  // useChat 内部已有 sessionId="" 清消息逻辑，但作为双重保险：
  // 如果组件因 React 复用而非 remount，内部 useLayoutEffect 可能不触发
  useEffect(() => {
    if (!propSessionId && messages.length > 0) {
      // 检查是否有正在进行的流式请求，避免中断
      const hasStreaming = messages.some((m) => m.isStreaming)
      if (!hasStreaming) {
        setMessages([])
      }
    }
  }, [propSessionId, messages.length, messages, setMessages])

  // 用户发送消息后自动滚动到底部，AI 回复时不滚动
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

  // UI refs
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const analysisFileRef = useRef<HTMLInputElement>(null)
  const analysisAbortControllerRef = useRef<AbortController | null>(null)

  // 分析模态框状态
  const [showAnalysisUpload, setShowAnalysisUpload] = useState(false)
  const [analysisFile, setAnalysisFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // 文件图标
  const getFileIcon = (file: File) => {
    if (file.type.startsWith("audio"))
      return (
        <Mic
          className={`size-4 ${isWarmTheme ? "text-warm-primary" : "text-purple-400"}`}
        />
      )
    if (file.type.startsWith("video"))
      return (
        <Video
          className={`size-4 ${isWarmTheme ? "text-warm-primary" : "text-blue-400"}`}
        />
      )
    return (
      <FileText
        className={`size-4 ${isWarmTheme ? "text-warm-primary" : "text-green-400"}`}
      />
    )
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
    "您好呀，我是您专属的心理医生朋友，您可以上传音频、视频甚至输入一段话来帮我分析您现在的心理状态，也可以输入「智能问答」让我来为您生成你想要的题目进行测试哦！"

  return (
    <div className="flex h-full gap-4 p-4">
      {/* 聊天区域 */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
        {/* 顶栏 */}
        <div className="shrink-0 flex items-center gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
              <Stethoscope className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">智能心理医生</h1>
              <p className="text-xs text-muted-foreground">
                多模态心理状况分析
              </p>
            </div>
          </div>
        </div>

        {/* 消息区域 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6">
              <div
                className={`flex size-16 items-center justify-center rounded-full ${
                  isWarmTheme ? "warm-gradient-bg warm-shadow" : "bg-primary/10"
                }`}
              >
                <Brain
                  className={`size-8 ${isWarmTheme ? "text-white" : "text-primary"}`}
                />
              </div>
              <div className="max-w-md text-center">
                <h2 className="mb-2 text-lg font-semibold">
                  多模态心理状况分析
                </h2>
                <p className="text-sm text-muted-foreground">
                  {openingStatement}
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <Avatar className="mt-0.5 size-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Stethoscope className="size-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="max-w-[80%] space-y-1">
                    {/* 消息文件 */}
                    {msg.files && msg.files.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {msg.files.map((f) => (
                          <div
                            key={f.id}
                            className="text-xs text-muted-foreground"
                          >
                            {f.type === "image" ? (
                              <img
                                src={f.url}
                                alt="附件"
                                className="max-h-48 rounded-md"
                              />
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded border px-2 py-1">
                                <FileText className="size-3" />
                                文件
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* 消息内容 */}
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    >
                      {msg.role === "assistant" ? (
                        msg.isStreaming ? (
                          <StreamingMessage
                            content={msg.content || ""}
                            isStreaming={msg.isStreaming}
                            className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-headings:text-foreground"
                          />
                        ) : (
                          <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-headings:text-foreground">
                            <ReactMarkdown>{msg.content || ""}</ReactMarkdown>
                          </div>
                        )
                      ) : (
                        msg.content || (msg.isStreaming ? "" : "...")
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
                      <AvatarFallback className="text-xs">
                        {(user?.full_name || "U").slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {/* 思考中指示器 */}
              {isStreaming &&
                !messages.some(
                  (m) => m.role === "assistant" && m.isStreaming && m.content,
                ) && (
                  <div className="flex gap-3">
                    <Avatar className="mt-0.5 size-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Stethoscope className="size-4" />
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
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div className="shrink-0 border-t bg-background p-4">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm transition-all hover:border-border">
              {/* 附件预览区域 */}
              {attachedFiles.length > 0 && (
                <div className="border-b border-border/60 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {attachedFiles.map((file, idx) => {
                      const isImage = file.type.startsWith("image")
                      const previewUrl = isImage
                        ? URL.createObjectURL(file)
                        : null
                      return (
                        <div
                          key={`${file.name}-${idx}`}
                          className={`group relative flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs transition-all hover:border-border ${isImage ? "pr-2" : "max-w-[200px]"}`}
                        >
                          <div className="shrink-0">
                            {isImage && previewUrl ? (
                              <div className="size-10 overflow-hidden rounded-md">
                                <img
                                  src={previewUrl}
                                  alt={file.name}
                                  className="size-full object-cover"
                                  onLoad={() => URL.revokeObjectURL(previewUrl)}
                                />
                              </div>
                            ) : (
                              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                                {getFileIcon(file)}
                              </div>
                            )}
                          </div>
                          {!isImage && (
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-foreground">
                                {file.name}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {(file.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                          )}
                          <button
                            type="button"
                            className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 opacity-0 shadow-sm transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                            onClick={() => {
                              removeAttachment(idx)
                              if (previewUrl) URL.revokeObjectURL(previewUrl)
                            }}
                          >
                            <X className="size-3 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 文本输入区域 */}
              <div className="px-4 py-3">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息，或上传文件进行分析..."
                  className="w-full resize-none border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  rows={1}
                  disabled={isStreaming}
                  style={{ maxHeight: "120px", minHeight: "24px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = "24px"
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                  }}
                />
              </div>

              {/* 工具栏区域 */}
              <div className="flex items-center justify-between border-t border-border/60 px-4 py-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="audio/*,video/*,image/*,.pdf,.doc,.docx,.txt,.md"
                    multiple
                    onChange={handleFileSelect}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-lg hover:bg-primary/10"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isStreaming}
                  >
                    <Paperclip className="size-4 text-muted-foreground" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAnalysisUpload(true)}
                    disabled={isStreaming}
                  >
                    <Brain className="size-4 mr-1" />
                    <span className="text-xs">心理状况分析</span>
                  </Button>
                </div>

                <Button
                  size="icon-sm"
                  className="rounded-lg bg-primary hover:bg-primary/90"
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
                    <Square className="size-4 fill-current" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 心理状况分析 - 文件上传模态框 */}
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
              setAnalysisFile(null)
              setIsAnalyzing(false)
            }}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">心理状况分析</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  analysisAbortControllerRef.current?.abort()
                  analysisAbortControllerRef.current = null
                  setShowAnalysisUpload(false)
                  setAnalysisFile(null)
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
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setAnalysisFile(file)
                }}
              />

              {!analysisFile ? (
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
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4 transition-all ${
                        isWarmTheme
                          ? "border-primary/30 hover:border-primary hover:bg-primary/10 warm-transition"
                          : "border-muted-foreground/30 hover:border-primary hover:bg-primary/5"
                      }`}
                    >
                      <FileText
                        className={`size-8 ${isWarmTheme ? "text-primary" : "text-blue-500"}`}
                      />
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
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4 transition-all ${
                        isWarmTheme
                          ? "border-primary/30 hover:border-primary hover:bg-primary/10 warm-transition"
                          : "border-muted-foreground/30 hover:border-primary hover:bg-primary/5"
                      }`}
                    >
                      <Mic
                        className={`size-8 ${isWarmTheme ? "text-primary" : "text-purple-500"}`}
                      />
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
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4 transition-all ${
                        isWarmTheme
                          ? "border-primary/30 hover:border-primary hover:bg-primary/10 warm-transition"
                          : "border-muted-foreground/30 hover:border-primary hover:bg-primary/5"
                      }`}
                    >
                      <Video
                        className={`size-8 ${isWarmTheme ? "text-primary" : "text-green-500"}`}
                      />
                      <span className="text-sm font-medium">视频</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`rounded-lg border p-4 ${
                    isWarmTheme
                      ? "bg-primary/10 border-primary/20"
                      : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-10 items-center justify-center rounded-lg ${
                        isWarmTheme ? "bg-primary/20" : "bg-primary/10"
                      }`}
                    >
                      {analysisFile.type.startsWith("audio") ? (
                        <Mic
                          className={`size-5 ${isWarmTheme ? "text-primary" : "text-purple-500"}`}
                        />
                      ) : analysisFile.type.startsWith("video") ? (
                        <Video
                          className={`size-5 ${isWarmTheme ? "text-primary" : "text-green-500"}`}
                        />
                      ) : (
                        <FileText
                          className={`size-5 ${isWarmTheme ? "text-primary" : "text-blue-500"}`}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {analysisFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(analysisFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnalysisFile(null)}
                      className="rounded-full p-1 hover:bg-destructive/10"
                    >
                      <X className="size-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!analysisFile || isAnalyzing}
              onClick={async () => {
                if (!analysisFile) return
                setIsAnalyzing(true)
                setShowAnalysisUpload(false)

                let accumulated = ""
                let streamHandledEnd = false

                try {
                  const abortController = new AbortController()
                  analysisAbortControllerRef.current = abortController

                  const uploadResult = await uploadFile(
                    analysisFile,
                    userId,
                    "ai-doctor",
                  )

                  const fileCategory = categorizeFile(analysisFile)

                  const userMsg = {
                    role: "user" as const,
                    content: `【心理状况分析】上传${fileCategory === "audio" ? "音频" : fileCategory === "video" ? "视频" : "文档"}文件：${analysisFile.name}`,
                  }
                  setMessages((prev) => [...prev, userMsg])

                  const assistantMsg = {
                    role: "assistant" as const,
                    content: "",
                    isStreaming: true,
                  }
                  setMessages((prev) => [...prev, assistantMsg])

                  const fileData = {
                    type:
                      fileCategory === "audio"
                        ? "audio"
                        : fileCategory === "video"
                          ? "video"
                          : "document",
                    transfer_method: "local_file",
                    url: uploadResult.id,
                    upload_file_id: uploadResult.id,
                  }

                  const inputs: Record<string, unknown> = {
                    video: fileCategory === "video" ? fileData : undefined,
                    audio: fileCategory === "audio" ? fileData : undefined,
                    text:
                      fileCategory === "text" || fileCategory === "document"
                        ? fileData
                        : undefined,
                    userinput: {
                      query:
                        "请你对我上传的档案文件进行专业心理状况分析，给出详细的分析报告。",
                      files: [],
                    },
                  }

                  const filesToSend = [
                    {
                      type:
                        fileCategory === "audio"
                          ? "audio"
                          : fileCategory === "video"
                            ? "video"
                            : "document",
                      transfer_method: "local_file",
                      url: uploadResult.id,
                      upload_file_id: uploadResult.id,
                    },
                  ]

                  await sendMessageStream(
                    "请你对我上传的档案文件进行专业心理状况分析，给出详细的分析报告。",
                    userId,
                    {
                      onWorkflowStarted() {
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
                      onMessage(answer) {
                        accumulated += answer
                        if (
                          accumulated.startsWith("正在分析中，请稍候...\n") &&
                          answer.trim().length > 0
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
                      onMessageEnd(_messageId, conversationId) {
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
                          file_name: analysisFile.name,
                          file_type: fileCategory,
                          file_size: analysisFile.size,
                          analysis_result: actualAnalysisResult,
                          conversation_id:
                            conversationId || activeConvId || null,
                        }
                        AnalysisService.createAnalysisReport({
                          requestBody: reportData,
                        })
                          .then((result) => {
                            console.log("保存分析报告成功:", result)
                          })
                          .catch((err) => {
                            console.error(
                              "保存分析报告到数据库失败，错误:",
                              err,
                            )
                          })

                        if (conversationId) {
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
                        loadConversations()
                      },
                      onWorkflowFinished() {
                        console.log("工作流结束")
                      },
                      onError(message) {
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
                    },
                    {
                      inputs: inputs,
                      files: filesToSend,
                      apiKeyName: "ai-doctor",
                      signal: abortController.signal,
                    },
                  )
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

                setAnalysisFile(null)
              }}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  分析中...
                </>
              ) : (
                "开始分析"
              )}
            </Button>

            {isAnalyzing && (
              <div className="mt-3 text-center text-sm text-muted-foreground">
                AI 正在分析您的档案，请稍候...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
