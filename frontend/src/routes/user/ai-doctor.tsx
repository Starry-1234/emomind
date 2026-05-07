import { createFileRoute } from "@tanstack/react-router"
import {
  Brain,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Stethoscope,
  Video,
  X,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useConversation } from "@/components/contexts/ConversationContext"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"
import { useCurrentTheme } from "@/hooks/useCurrentTheme"
import { createAnalysisReport } from "@/services/analysisApi"
import {
  DIFY_AI_DOCTOR_API_KEY,
  type DifyMessageFile,
  getMessages,
  sendMessageStream,
  uploadFile,
} from "@/services/difyApi"

export const Route = createFileRoute("/user/ai-doctor")({
  component: AiDoctor,
  head: () => ({
    meta: [{ title: "智能心理医生" }],
  }),
})

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  files?: DifyMessageFile[]
  isStreaming?: boolean
}

function AiDoctor() {
  const { user } = useAuth()
  const userId = user?.id || "anonymous"
  const { activeConvId, setActiveConvId, loadConversations } = useConversation()
  const { isWarmTheme } = useCurrentTheme()

  // 消息
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [_streamingContent, setStreamingContent] = useState("")
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])

  // UI
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const analysisFileRef = useRef<HTMLInputElement>(null)
  const [showAnalysisUpload, setShowAnalysisUpload] = useState(false)
  const [analysisFile, setAnalysisFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // 加载某个会话的消息
  const loadMessages = useCallback(
    async (convId: string) => {
      try {
        const result = await getMessages(userId, convId, {
          apiKey: DIFY_AI_DOCTOR_API_KEY,
        })
        const chatMsgs: ChatMessage[] = []
        const sorted = [...result.data].sort(
          (a, b) => a.created_at - b.created_at,
        )
        for (const msg of sorted) {
          if (msg.query) {
            chatMsgs.push({
              role: "user",
              content: msg.query,
              files: msg.message_files,
            })
          }
          if (msg.answer) {
            chatMsgs.push({
              role: "assistant",
              content: msg.answer,
              files: msg.message_files,
            })
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

  // 当 activeConvId 变化时加载消息
  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId)
    } else {
      setMessages([])
    }
  }, [activeConvId, loadMessages])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  // 发送消息
  const handleSend = async (extraFiles?: File[]) => {
    const text = inputText.trim()
    const filesToSend = [...(extraFiles || []), ...attachedFiles]
    if (!text && filesToSend.length === 0) return
    if (isStreaming) return

    const userMsg: ChatMessage = { role: "user", content: text }
    setMessages((prev) => [...prev, userMsg])
    setInputText("")
    setStreamingContent("")
    setIsStreaming(true)

    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      isStreaming: true,
    }
    setMessages((prev) => [...prev, assistantMsg])

    const uploadedFiles: {
      type: string
      transfer_method: string
      url: string
      upload_file_id?: string
    }[] = []
    for (const file of filesToSend) {
      try {
        const result = await uploadFile(file, userId, DIFY_AI_DOCTOR_API_KEY)
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
            accumulated += answer
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
            setIsStreaming(false)
            setMessages((prev) => {
              const newMsgs = [...prev]
              const last = newMsgs[newMsgs.length - 1]
              if (last?.isStreaming) {
                newMsgs[newMsgs.length - 1] = { ...last, isStreaming: false }
              }
              return newMsgs
            })
            if (conversationId && !activeConvId) {
              setActiveConvId(conversationId)
            }
            loadConversations()
          },
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
          onError(message) {
            streamHandledEnd = true
            setIsStreaming(false)
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
          files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
          apiKey: DIFY_AI_DOCTOR_API_KEY,
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

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...Array.from(files)])
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // 移除附件
  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // 文件图标
  const getFileIcon = (file: File) => {
    if (file.type.startsWith("audio"))
      return <Mic className={`size-4 ${isWarmTheme ? 'text-warm-primary' : 'text-purple-400'}`} />
    if (file.type.startsWith("video"))
      return <Video className={`size-4 ${isWarmTheme ? 'text-warm-primary' : 'text-blue-400'}`} />
    return <FileText className={`size-4 ${isWarmTheme ? 'text-warm-primary' : 'text-green-400'}`} />
  }

  // 开场白
  const openingStatement =
    "您好呀，我是您专属的心理医生朋友，您可以上传音频、视频甚至输入一段话来帮我分析您现在的心理状态，也可以输入「智能问答」让我来为您生成你想要的题目进行测试哦！"

  return (
    <div className="flex h-full gap-4 p-4">
      {/* 聊天区域 */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
        {/* 顶栏 */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
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
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6">
              <div className={`flex size-16 items-center justify-center rounded-full ${
                isWarmTheme ? 'warm-gradient-bg warm-shadow' : 'bg-primary/10'
              }`}>
                <Brain className={`size-8 ${isWarmTheme ? 'text-white' : 'text-primary'}`} />
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
                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-headings:text-foreground">
                          <ReactMarkdown>{msg.content || ""}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content || (msg.isStreaming ? "" : "...")
                      )}
                      {msg.isStreaming && msg.content && (
                        <span className="ml-0.5 inline-block animate-pulse">
                          |
                        </span>
                      )}
                    </div>
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
              {isStreaming && !messages[messages.length - 1]?.content && (
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

        {/* 输入区域 - 豆包风格 */}
        <div className="border-t bg-background p-4">
          <div className="mx-auto max-w-3xl">
            {/* 输入框容器 - 豆包风格 */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm transition-all hover:border-border">
              {/* 附件预览区域 - 在输入框上方 */}
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
                          {/* 文件图标或预览图 */}
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

                          {/* 文件信息 */}
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

                          {/* 删除按钮 */}
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

              {/* 文本输入区域 - 上方 */}
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

              {/* 工具栏区域 - 下方 */}
              <div className="flex items-center justify-between border-t border-border/60 px-4 py-2">
                {/* 左侧：文件上传按钮 + 心理状况分析按钮 */}
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

                  {/* 心理状况分析按钮 */}
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

                {/* 右侧：发送按钮 */}
                <Button
                  size="icon-sm"
                  className="rounded-lg bg-primary hover:bg-primary/90"
                  onClick={() => handleSend()}
                  disabled={
                    isStreaming ||
                    (!inputText.trim() && attachedFiles.length === 0)
                  }
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
        </div>
      </div>

      {/* 心理状况分析 - 文件上传模态框 */}
      {showAnalysisUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 背景遮罩 */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowAnalysisUpload(false)
              setAnalysisFile(null)
            }}
          />

          {/* 模态框内容 */}
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl">
            {/* 标题 */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">心理状况分析</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setShowAnalysisUpload(false)
                  setAnalysisFile(null)
                }}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* 文件上传区域 */}
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
                          ? 'border-primary/30 hover:border-primary hover:bg-primary/10 warm-transition'
                          : 'border-muted-foreground/30 hover:border-primary hover:bg-primary/5'
                      }`}
                    >
                      <FileText className={`size-8 ${isWarmTheme ? 'text-primary' : 'text-blue-500'}`} />
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
                          ? 'border-primary/30 hover:border-primary hover:bg-primary/10 warm-transition'
                          : 'border-muted-foreground/30 hover:border-primary hover:bg-primary/5'
                      }`}
                    >
                      <Mic className={`size-8 ${isWarmTheme ? 'text-primary' : 'text-purple-500'}`} />
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
                          ? 'border-primary/30 hover:border-primary hover:bg-primary/10 warm-transition'
                          : 'border-muted-foreground/30 hover:border-primary hover:bg-primary/5'
                      }`}
                    >
                      <Video className={`size-8 ${isWarmTheme ? 'text-primary' : 'text-green-500'}`} />
                      <span className="text-sm font-medium">视频</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`rounded-lg border p-4 ${
                  isWarmTheme ? 'bg-primary/10 border-primary/20' : 'bg-muted/30'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-lg ${
                      isWarmTheme ? 'bg-primary/20' : 'bg-primary/10'
                    }`}>
                      {analysisFile.type.startsWith("audio") ? (
                        <Mic className={`size-5 ${isWarmTheme ? 'text-primary' : 'text-purple-500'}`} />
                      ) : analysisFile.type.startsWith("video") ? (
                        <Video className={`size-5 ${isWarmTheme ? 'text-primary' : 'text-green-500'}`} />
                      ) : (
                        <FileText className={`size-5 ${isWarmTheme ? 'text-primary' : 'text-blue-500'}`} />
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

            {/* 分析按钮 */}
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
                  const uploadResult = await uploadFile(
                    analysisFile,
                    userId,
                    DIFY_AI_DOCTOR_API_KEY,
                  )

                  const userMsg: ChatMessage = {
                    role: "user",
                    content: `【心理状况分析】上传文件：${analysisFile.name}`,
                  }
                  setMessages((prev) => [...prev, userMsg])

                  const assistantMsg: ChatMessage = {
                    role: "assistant",
                    content: "",
                    isStreaming: true,
                  }
                  setMessages((prev) => [...prev, assistantMsg])

                  const fileType = analysisFile.type.startsWith("audio")
                    ? "audio"
                    : analysisFile.type.startsWith("video")
                      ? "video"
                      : "document"

                  await sendMessageStream(
                    "请你对我上传的档案文件进行专业心理状况分析，给出详细的分析报告。",
                    userId,
                    {
                      onMessage(answer) {
                        accumulated += answer
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
                            newMsgs[newMsgs.length - 1] = {
                              ...last,
                              isStreaming: false,
                            }
                          }
                          return newMsgs
                        })

                        const token = localStorage.getItem("access_token") || ""
                        createAnalysisReport(
                          {
                            file_name: analysisFile!.name,
                            file_type: fileType,
                            file_size: analysisFile!.size,
                            analysis_result: accumulated,
                            conversation_id:
                              conversationId || activeConvId || null,
                          },
                          token,
                        ).catch(() => {
                          console.error("保存分析报告到数据库失败")
                        })

                        if (conversationId && !activeConvId) {
                          setActiveConvId(conversationId)
                        }
                        loadConversations()
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
                      files: [
                        {
                          type: fileType,
                          transfer_method: "local_file",
                          url: uploadResult.id,
                          upload_file_id: uploadResult.id,
                        },
                      ],
                      apiKey: DIFY_AI_DOCTOR_API_KEY,
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

            {/* 分析中的提示 */}
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
