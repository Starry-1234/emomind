const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

// API Key 由后端管理，前端不持有
// 可选指定使用哪个 key (apiKeyName: "ai-doctor" | "test")
const DIFY_API_KEY_NAME = "ai-doctor"

// 获取认证 token
function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("access_token")
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

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
  onMessage?: (
    answer: string,
    messageId: string,
    conversationId: string,
  ) => void
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
    inputs?: Record<string, unknown>
    conversationId?: string
    files?: {
      type: string
      transfer_method: string
      url: string
      upload_file_id?: string
    }[]
    apiKeyName?: string
    signal?: AbortSignal
  },
): Promise<void> {
  const apiKeyName = options?.apiKeyName || DIFY_API_KEY_NAME
  const body: Record<string, unknown> = {
    inputs: options?.inputs || {},
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
    response = await fetch(
      `${API_BASE_URL}/api/v1/dify/chat-messages?api_key_name=${apiKeyName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(body),
        signal: options?.signal,
      },
    )
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return
    }
    callbacks.onError?.(
      `网络连接失败: ${err instanceof Error ? err.message : "未知错误"}`,
    )
    return
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error("请求失败，错误内容:", errorText)
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
  let readerClosed = false

  // 监听 abort 信号，立即取消 reader
  // 核心修复：fetch 收到响应后，abort() 不会自动取消 ReadableStream 的 reader
  // 必须显式调用 reader.cancel() 才能让阻塞的 reader.read() 立即返回
  if (options?.signal) {
    if (options.signal.aborted) {
      // 信号已中止，直接清理
      try {
        reader.cancel("abort")
      } catch {
        /* ignore */
      }
      try {
        reader.releaseLock()
      } catch {
        /* ignore */
      }
      return
    }
    options.signal.addEventListener(
      "abort",
      () => {
        if (!readerClosed) {
          readerClosed = true
          try {
            reader.cancel("abort")
          } catch {
            /* ignore */
          }
          try {
            reader.releaseLock()
          } catch {
            /* ignore */
          }
        }
      },
      { once: true },
    )
  }

  try {
    while (true) {
      // 用户主动中止时，立即停止读取新数据
      if (options?.signal?.aborted) {
        break
      }
      const { done, value } = await reader.read()
      // 用户主动中止时，丢弃已读取的 value
      if (options?.signal?.aborted) {
        break
      }
      if (done) {
        break
      }

      const decoded = decoder.decode(value, { stream: true })
      buffer += decoded
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        // 用户主动中止时，立即停止处理已缓冲的数据
        if (options?.signal?.aborted) {
          break
        }

        const data = parseSSEData(line)
        if (!data) {
          continue
        }

        try {
          const parsed = JSON.parse(data)

          switch (parsed.event) {
            case "message":
              callbacks.onMessage?.(
                parsed.answer || "",
                parsed.message_id,
                parsed.conversation_id,
              )
              break
            case "message_end":
              callbacks.onMessageEnd?.(
                parsed.message_id,
                parsed.conversation_id,
              )
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
          // 忽略解析失败的行
        }
      }
    }
  } catch (err) {
    // 用户主动中止（abort 信号已触发），静默退出
    if (options?.signal?.aborted) {
      // 用户点击了停止按钮，静默退出
    } else if (err instanceof Error && err.name === "AbortError") {
      // fetch 层面的 AbortError，静默退出
    } else {
      callbacks.onError?.(
        `读取响应流时出错: ${err instanceof Error ? err.message : "未知错误"}`,
      )
    }
  } finally {
    // 无论如何都释放 reader，确保 stream 被正确关闭
    if (!readerClosed) {
      readerClosed = true
      try {
        await reader.cancel("cleanup")
      } catch {
        // 已取消或已释放则忽略
      }
      try {
        reader.releaseLock()
      } catch {
        // 已释放则忽略
      }
    }
  }
}

export async function uploadFile(
  file: File,
  user: string,
  apiKeyName?: string,
): Promise<DifyUploadResult> {
  const keyName = apiKeyName || DIFY_API_KEY_NAME
  // Convert file to base64 for backend proxy
  const arrayBuffer = await file.arrayBuffer()
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      "",
    ),
  )

  const response = await fetch(
    `${API_BASE_URL}/api/v1/dify/files/upload?api_key_name=${keyName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        file_name: file.name,
        file_data: base64,
        user: user,
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`文件上传失败 (${response.status}): ${errorText}`)
  }

  return response.json()
}

export async function getConversations(
  user: string,
  options?: { lastId?: string; limit?: number; apiKeyName?: string },
): Promise<{ data: DifyConversation[]; has_more: boolean }> {
  const keyName = options?.apiKeyName || DIFY_API_KEY_NAME
  const params = new URLSearchParams()
  params.set("user", user)
  params.set("limit", String(options?.limit || 20))
  if (options?.lastId) {
    params.set("last_id", options.lastId)
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/dify/conversations?${params}&api_key_name=${keyName}`,
    {
      headers: {
        ...getAuthHeader(),
      },
    },
  )

  if (!response.ok) {
    throw new Error(`获取会话列表失败 (${response.status})`)
  }

  return response.json()
}

export async function getConversationCount(
  user: string,
  apiKeyName?: string,
): Promise<number> {
  let count = 0
  let lastId: string | undefined
  let hasMore = true

  while (hasMore) {
    const result = await getConversations(user, {
      lastId,
      limit: 100,
      apiKeyName,
    })
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
  options?: { firstId?: string; limit?: number; apiKeyName?: string },
): Promise<{ data: DifyMessage[]; has_more: boolean }> {
  const keyName = options?.apiKeyName || DIFY_API_KEY_NAME
  const params = new URLSearchParams()
  params.set("user", user)
  params.set("conversation_id", conversationId)
  params.set("limit", String(options?.limit || 20))
  if (options?.firstId) {
    params.set("first_id", options.firstId)
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/dify/messages?${params}&api_key_name=${keyName}`,
    {
      headers: {
        ...getAuthHeader(),
      },
    },
  )

  if (!response.ok) {
    throw new Error(`获取消息历史失败 (${response.status})`)
  }

  return response.json()
}

export async function deleteConversation(
  conversationId: string,
  user: string,
  apiKeyName?: string,
): Promise<void> {
  const keyName = apiKeyName || DIFY_API_KEY_NAME
  const response = await fetch(
    `${API_BASE_URL}/api/v1/dify/conversations/${conversationId}?user=${user}&api_key_name=${keyName}`,
    {
      method: "DELETE",
      headers: {
        ...getAuthHeader(),
      },
    },
  )

  if (!response.ok && response.status !== 204) {
    throw new Error(`删除会话失败 (${response.status})`)
  }
}
