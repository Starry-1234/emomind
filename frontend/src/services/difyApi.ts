const DIFY_BASE_URL = import.meta.env.VITE_DIFY_API_URL || "http://localhost/v1"

// 各工作流专用 API Key（从环境变量读取）
const DIFY_AI_DOCTOR_API_KEY = import.meta.env.VITE_DIFY_AI_DOCTOR_API_KEY || ""
const DIFY_TEST_API_KEY = import.meta.env.VITE_DIFY_TEST_API_KEY || ""

/** 兼容旧代码的默认 Key（指向智能心理医生） */
const DIFY_API_KEY = DIFY_AI_DOCTOR_API_KEY

export { DIFY_AI_DOCTOR_API_KEY, DIFY_TEST_API_KEY, DIFY_API_KEY }

export interface DifyMessage {
  id: string
  conversation_id: string
  answer: string
  query: string
  message_files?: DifyMessageFile[]
  feedback?: { rating: string } | null
  created_at: number
}

export interface DifyMessageFile {
  id: string
  type: "image" | "document" | "audio" | "video"
  url: string
  belongs_to: "user" | "assistant"
}

export interface DifyConversation {
  id: string
  name: string
  inputs: Record<string, unknown>
  status: string
  created_at: number
  updated_at: number
}

export interface DifyUploadResult {
  id: string
  name: string
  size: number
  extension: string
  mime_type: string
}

export interface StreamCallbacks {
  onMessage?: (answer: string, messageId: string, conversationId: string) => void
  onMessageEnd?: (messageId: string, conversationId: string) => void
  onMessageFile?: (file: DifyMessageFile) => void
  onError?: (message: string) => void
  onWorkflowStarted?: () => void
  onWorkflowFinished?: () => void
}

function parseSSEData(line: string): string | null {
  if (line.startsWith("data: ")) {
    return line.slice(6)
  }
  return null
}

export async function sendMessageStream(
  query: string,
  user: string,
  callbacks: StreamCallbacks,
  options?: {
    conversationId?: string
    files?: { type: string; transfer_method: string; url: string; upload_file_id?: string }[]
    apiKey?: string
  }
): Promise<void> {
  const key = options?.apiKey || DIFY_API_KEY
  const body: Record<string, unknown> = {
    inputs: {},
    query,
    response_mode: "streaming",
    conversation_id: options?.conversationId || "",
    user,
    auto_generate_name: true,
  }

  if (options?.files && options.files.length > 0) {
    body.files = options.files
  }

  let response: Response
  try {
    response = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    callbacks.onError?.(`网络连接失败: ${err instanceof Error ? err.message : "未知错误"}`)
    return
  }

  if (!response.ok) {
    const errorText = await response.text()
    callbacks.onError?.(`请求失败 (${response.status}): ${errorText}`)
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    callbacks.onError?.("无法读取响应流")
    return
  }

  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        const data = parseSSEData(line)
        if (!data) continue

        try {
          const parsed = JSON.parse(data)

          switch (parsed.event) {
            case "message":
              callbacks.onMessage?.(parsed.answer || "", parsed.message_id, parsed.conversation_id)
              break
            case "message_end":
              callbacks.onMessageEnd?.(parsed.message_id, parsed.conversation_id)
              break
            case "message_file":
              if (parsed.type === "image") {
                callbacks.onMessageFile?.({
                  id: parsed.id,
                  type: parsed.type,
                  url: parsed.url,
                  belongs_to: parsed.belongs_to || "assistant",
                })
              }
              break
            case "workflow_started":
              callbacks.onWorkflowStarted?.()
              break
            case "workflow_finished":
              callbacks.onWorkflowFinished?.()
              break
            case "error":
              callbacks.onError?.(parsed.message || "发生错误")
              break
          }
        } catch {
          // skip unparseable lines
        }
      }
    }
  } catch (err) {
    callbacks.onError?.(`读取响应流时出错: ${err instanceof Error ? err.message : "未知错误"}`)
  } finally {
    reader.releaseLock()
  }
}

export async function uploadFile(
  file: File,
  user: string,
  apiKey?: string
): Promise<DifyUploadResult> {
  const key = apiKey || DIFY_API_KEY
  const formData = new FormData()
  formData.append("file", file)
  formData.append("user", user)

  const response = await fetch(`${DIFY_BASE_URL}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`文件上传失败 (${response.status}): ${errorText}`)
  }

  return response.json()
}

export async function getConversations(
  user: string,
  options?: { lastId?: string; limit?: number; apiKey?: string }
): Promise<{ data: DifyConversation[]; has_more: boolean }> {
  const key = options?.apiKey || DIFY_API_KEY
  const params = new URLSearchParams()
  params.set("user", user)
  params.set("limit", String(options?.limit || 20))
  if (options?.lastId) {
    params.set("last_id", options.lastId)
  }

  const response = await fetch(`${DIFY_BASE_URL}/conversations?${params}`, {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  })

  if (!response.ok) {
    throw new Error(`获取会话列表失败 (${response.status})`)
  }

  return response.json()
}

export async function getConversationCount(
  user: string,
  apiKey?: string
): Promise<number> {
  let count = 0
  let lastId: string | undefined = undefined
  let hasMore = true

  while (hasMore) {
    const result = await getConversations(user, { lastId, limit: 100, apiKey })
    count += result.data.length
    hasMore = result.has_more
    if (result.data.length > 0) {
      lastId = result.data[result.data.length - 1].id
    }
  }

  return count
}

export async function getMessages(
  user: string,
  conversationId: string,
  options?: { firstId?: string; limit?: number; apiKey?: string }
): Promise<{ data: DifyMessage[]; has_more: boolean }> {
  const key = options?.apiKey || DIFY_API_KEY
  const params = new URLSearchParams()
  params.set("user", user)
  params.set("conversation_id", conversationId)
  params.set("limit", String(options?.limit || 20))
  if (options?.firstId) {
    params.set("first_id", options.firstId)
  }

  const response = await fetch(`${DIFY_BASE_URL}/messages?${params}`, {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  })

  if (!response.ok) {
    throw new Error(`获取消息历史失败 (${response.status})`)
  }

  return response.json()
}

export async function deleteConversation(
  conversationId: string,
  user: string,
  apiKey?: string
): Promise<void> {
  const key = apiKey || DIFY_API_KEY
  const response = await fetch(`${DIFY_BASE_URL}/conversations/${conversationId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ user }),
  })

  if (!response.ok && response.status !== 204) {
    throw new Error(`删除会话失败 (${response.status})`)
  }
}
