# 08 · 前端迁移指南

## 1. 目标

把 `emomind-sb/frontend` 中与 Dify 强耦合的部分：
- `src/services/difyApi.ts`（删除）
- `src/hooks/useChat.ts` 中的 Dify 特定逻辑（重写为 LangGraph）
- 路由层 `src/routes/user/ai-doctor/` 和 `src/routes/user/test/`（沿用结构）

迁移为基于 LangGraph 原生事件的实现，**保留所有用户交互能力**。

## 2. 文件变更清单

### 2.1 删除

| 路径 | 处置 |
|------|------|
| `src/services/difyApi.ts` | 删除 |

### 2.2 新增

| 路径 | 说明 |
|------|------|
| `src/services/langgraphApi.ts` | 替代 difyApi.ts，调用 LangGraph 后端 |
| `src/services/langgraphTypes.ts` | LangGraph 专用类型（DifyMessage → LangGraphMessage）|
| `src/lib/sseParser.ts` | 通用 SSE 解析器（从 difyApi 抽出）|

### 2.3 重写

| 路径 | 说明 |
|------|------|
| `src/hooks/useChat.ts` | 内部调用从 difyApi 切到 langgraphApi；行为不变 |

### 2.4 不变

| 路径 | 说明 |
|------|------|
| `src/components/chat/*` | 展示组件，只通过 useChat hook 拿数据 |
| `src/routes/user/ai-doctor/*` | 路由结构不变 |
| `src/routes/user/test/*` | 路由结构不变 |
| `src/contexts/ConversationContext.tsx` | 不变 |
| `src/hooks/useAuth.ts` | 不变 |
| `src/hooks/usePsychologicalTest.ts` | 视需要小幅调整（见 §6）|

## 3. `langgraphApi.ts` 设计

### 3.1 类型定义

```typescript
// src/services/langgraphTypes.ts
export type LangGraphRole = "user" | "assistant"

export interface LangGraphFile {
  file_id: string
  url: string
  mime: string
  size: number
  name?: string
}

export interface LangGraphMessage {
  role: LangGraphRole
  content: string
  files?: LangGraphFile[]
  // 本地状态字段（不发到后端）
  isStreaming?: boolean
  isPaused?: boolean
  userQuery?: string
  versions?: string[]
  currentVersion?: number
  threadId?: string
  runId?: string
}

export interface LangGraphConversation {
  thread_id: string
  title: string
  graph: "ai-doctor" | "psych-test"
  created_at: string
  updated_at: string
}

export interface StreamCallbacks {
  onNodeStart?: (nodeName: string) => void
  onToken?: (delta: string) => void
  onToolCall?: (name: string, args: Record<string, unknown>) => void
  onMessageEnd?: (threadId: string, runId: string, fullContent: string, files?: LangGraphFile[]) => void
  onWorkflowEvent?: (type: string, payload: unknown) => void
  onError?: (code: string, message: string, recoverable: boolean) => void
}

export interface SendOptions {
  threadId?: string
  graph: "ai-doctor" | "psych-test"
  signal?: AbortSignal
}
```

### 3.2 主函数

```typescript
// src/services/langgraphApi.ts
import type {
  LangGraphMessage,
  LangGraphFile,
  LangGraphConversation,
  StreamCallbacks,
  SendOptions,
} from "./langgraphTypes"

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080"

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function parseSSEEvent(line: string): { event?: string; data: string } | null {
  if (line.startsWith("event: ")) {
    return { event: line.slice(7).trim(), data: "" }
  }
  if (line.startsWith("data: ")) {
    return { data: line.slice(6) }
  }
  return null
}

function parseSSEChunk(chunk: string): Array<{ event?: string; data: string }> {
  const events: Array<{ event?: string; data: string }> = []
  const lines = chunk.split("\n")
  let current: { event?: string; data: string } | null = null

  for (const line of lines) {
    if (line.trim() === "") {
      if (current && current.data) {
        events.push(current)
      }
      current = null
      continue
    }
    const parsed = parseSSEEvent(line)
    if (!parsed) continue
    if (parsed.event) {
      current = { event: parsed.event, data: "" }
    } else if (parsed.data) {
      if (current) {
        current.data = current.data ? `${current.data}\n${parsed.data}` : parsed.data
      } else {
        events.push({ data: parsed.data })
      }
    }
  }
  return events
}

export async function sendChatStream(
  graph: "ai-doctor" | "psych-test",
  input: { messages: LangGraphMessage[]; files?: LangGraphFile[] },
  callbacks: StreamCallbacks,
  options?: SendOptions,
): Promise<void> {
  const body = {
    graph,
    thread_id: options?.threadId,
    input,
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...getAuthHeader(),
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return
    callbacks.onError?.("NETWORK_ERROR", `网络连接失败: ${err}`, true)
    return
  }

  if (!response.ok) {
    const text = await response.text()
    callbacks.onError?.("HTTP_ERROR", `请求失败 (${response.status}): ${text}`, false)
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    callbacks.onError?.("NO_READER", "无法读取响应流", false)
    return
  }

  // 同 difyApi.ts 中的 abort 处理
  let readerClosed = false
  if (options?.signal) {
    if (options.signal.aborted) {
      reader.cancel("abort").catch(() => {})
      reader.releaseLock()
      return
    }
    options.signal.addEventListener(
      "abort",
      () => {
        if (!readerClosed) {
          readerClosed = true
          reader.cancel("abort").catch(() => {})
          reader.releaseLock()
        }
      },
      { once: true },
    )
  }

  const decoder = new TextDecoder()
  let buffer = ""
  let currentEvent: string | null = null

  try {
    while (true) {
      if (options?.signal?.aborted) break
      const { done, value } = await reader.read()
      if (options?.signal?.aborted) break
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (options?.signal?.aborted) break
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim()
          continue
        }
        if (line.startsWith("data: ")) {
          const data = line.slice(6)
          try {
            const parsed = JSON.parse(data)
            dispatchSSEEvent(currentEvent, parsed, callbacks)
          } catch {
            // 忽略非 JSON
          }
          currentEvent = null
        }
      }
    }
  } catch (err) {
    if (options?.signal?.aborted) return
    if (err instanceof Error && err.name === "AbortError") return
    callbacks.onError?.("STREAM_ERROR", `读取响应流时出错: ${err}`, true)
  } finally {
    if (!readerClosed) {
      readerClosed = true
      reader.cancel("cleanup").catch(() => {})
      reader.releaseLock()
    }
  }
}

function dispatchSSEEvent(
  event: string | null,
  data: any,
  callbacks: StreamCallbacks,
) {
  switch (event) {
    case "node_start":
      callbacks.onNodeStart?.(data.name)
      break
    case "token":
      callbacks.onToken?.(data.delta || "")
      break
    case "tool_call":
      callbacks.onToolCall?.(data.name, data.args || {})
      break
    case "message_end":
      callbacks.onMessageEnd?.(
        data.thread_id,
        data.run_id,
        data.full_content || "",
        data.files,
      )
      break
    case "workflow_event":
      callbacks.onWorkflowEvent?.(data.type, data.payload)
      break
    case "error":
      callbacks.onError?.(data.code || "UNKNOWN", data.message || "发生错误", data.recoverable !== false)
      break
  }
}

export async function stopChat(threadId: string, runId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/ai/chat/stop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ thread_id: threadId, run_id: runId }),
  })
}

export async function uploadFile(file: File): Promise<LangGraphFile> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch(`${API_BASE_URL}/api/v1/ai/files/upload`, {
    method: "POST",
    headers: getAuthHeader(),
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`文件上传失败 (${response.status})`)
  }

  return response.json()
}

export async function getConversations(graph: string): Promise<LangGraphConversation[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/ai/conversations?graph=${graph}`,
    { headers: getAuthHeader() },
  )
  if (!response.ok) throw new Error(`获取会话列表失败 (${response.status})`)
  return response.json()
}

export async function getMessages(threadId: string, graph: string): Promise<LangGraphMessage[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/ai/messages?thread_id=${threadId}&graph=${graph}`,
    { headers: getAuthHeader() },
  )
  if (!response.ok) throw new Error(`获取消息历史失败 (${response.status})`)
  const data = await response.json()
  return data.messages || data
}

export async function deleteConversation(threadId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/ai/conversations/${threadId}`,
    { method: "DELETE", headers: getAuthHeader() },
  )
  if (!response.ok && response.status !== 204) {
    throw new Error(`删除会话失败 (${response.status})`)
  }
}
```

## 4. `useChat.ts` 重写策略

### 4.1 总体原则

**行为不变**，**内部实现切换**。所有现有 Playwright 测试用例应当不需修改（除了把 URL / 类型更新）。

### 4.2 关键改动点

| 旧（difyApi） | 新（langgraphApi） |
|--------------|-------------------|
| `import { sendMessageStream, ... } from "@/services/difyApi"` | `import { sendChatStream, stopChat, ... } from "@/services/langgraphApi"` |
| `apiKeyName: "ai-doctor" \| "test"` | `graph: "ai-doctor" \| "psych-test"` |
| callback `onMessage(answer, messageId, conversationId)` | callback `onToken(delta)` + `onMessageEnd(threadId, runId, fullContent, files)` |
| callback `onMessageFile(file)` | 文件信息包含在 `onMessageEnd.files` 中 |
| callback `onWorkflowStarted/Finished` | 合并到 `onWorkflowEvent(type, payload)` |
| 无 `stopChat` 调用 | 新增：在 `handleStop` 中调 `stopChat(threadId, runId)` |
| Dify `message_id` | LangGraph `run_id`（同一概念）|
| Dify `conversation_id` | LangGraph `thread_id`（同一概念）|

### 4.3 改动量预估

useChat.ts 当前 ~1458 行（Dify 版）。重写后：
- 类型替换：~50 行
- callback 适配（合并 onMessage + onMessageEnd 到累积逻辑）：~30 行
- handleStop 调 stopChat：~10 行
- 文件附件从 onMessageFile 改为从 onMessageEnd.files：~30 行
- **其他逻辑（sessionStorage / registry / polling / 版本切换 / 注册表）几乎不变**

预期重写后 ~1300 行，行为完全一致。

### 4.4 关键回调映射

```typescript
// 旧 difyApi onMessage: 流式累积 token
// 新 langgraphApi: onToken (delta) 累积 + onMessageEnd (fullContent) 最终值
let accumulated = ""
let streamHandledEnd = false

await sendChatStream(graph, input, {
  onToken: (delta) => {
    if (stoppedRef.current) return
    accumulated += delta
    // 累积到 messagesRef.current 最后一个 assistant 消息
    updateMessagesAndCache(appendAccumulated(accumulated), true)
  },
  onMessageEnd: (threadId, runId, fullContent, files) => {
    throttled.flush()
    streamHandledEnd = true
    setIsStreaming(false)
    // 用 fullContent 作为最终值（覆盖累积）
    finalizeMessage(fullContent, files)
    // 处理 thread_id 解析（同旧逻辑）
    if (threadId && !sessionIdRef.current) {
      onSessionCreatedRef.current?.(threadId)
    }
  },
  onWorkflowEvent: (type, payload) => {
    // 旧 onWorkflowStarted/Finished 合并到这里
    if (type === "test_progress") {
      // 更新进度条
    }
  },
  onError: (code, message, recoverable) => {
    // 同旧逻辑
  },
}, { threadId: sessionId || undefined, signal: abortController.signal })
```

## 5. 路由层调整

### 5.1 `/user/ai-doctor/chat/$sessionId.tsx`

- 不变（route params 仍用 sessionId，逻辑映射到 threadId）

### 5.2 `/user/test/chat/$sessionId.tsx`

- 不变

### 5.3 关键变化

| 旧（dify） | 新（langgraph） |
|-----------|----------------|
| `useChat(userId, sessionId, ...)` 6th param `apiKeyName` | 6th param `graph` |
| 内部根据 apiKeyName 切到 Dify chat-messages | 内部根据 graph 切到 LangGraph graph 名 |

## 6. `usePsychologicalTest.ts`（如需调整）

如果现有 usePsychologicalTest hook 内部有 Dify 特定调用，需替换：

| 旧 | 新 |
|----|---|
| `difyApi.getTestTemplate()`（如果存在）| `langgraphApi.getConversations("psych-test")` 或新加 `getTestTemplate()` 端点 |
| 直接调 dify 评分逻辑（如有）| 通过 backend 调 LangGraph 测评图 |

具体调整视现状代码决定，原则是**业务逻辑（评分规则）保持在前端或后端 service 一处，不分散**。

## 7. 迁移步骤

1. **M1**：先重写 langgraphApi.ts（仅 ai-doctor 文本路径），让 useChat 接 langgraphApi 但**只支持 ai-doctor**
2. **M2**：扩展 langgraphApi 支持文件上传
3. **M3**：扩展支持 psych-test graph 参数
4. **M4-M5**：完善 useChat 的高级交互（stop / 多版本 / 暂停继续）
5. **M6**：删除 difyApi.ts 与所有 Dify 相关导入

## 8. 测试要点

E2E 测试（Playwright）必须保持现有覆盖度，并补充：
- `chat-streaming.spec.ts`（替换原版本）
- `chat-stop.spec.ts`（验证 stopChat 调用 + SSE 断开）
- `chat-regenerate-versions.spec.ts`（同旧测试，但走 LangGraph 后端）
- `chat-pause-resume.spec.ts`（暂停 + 继续，验证 thread_id 一致）
- `chat-file-upload.spec.ts`（图片上传 + 文本输入）
- `chat-multimodal.spec.ts`（音频/视频，验证 Qwen3-Omni 路径）
- `test-complete-flow.spec.ts`（走完测评全流程）

## 9. 已知迁移风险

| 风险 | 缓解 |
|------|------|
| SSE 事件名差异（Dify 用 snake_case，LangGraph 用我们自定义的 event= 字段）| 测试覆盖所有事件类型 |
| 流式累积逻辑漂移（前端累积 vs 后端 fullContent 覆盖）| 在 onMessageEnd 用 fullContent 强制覆盖一次 |
| 文件信息位置变化（从 onMessageFile 移到 onMessageEnd.files）| 重构时统一处理 |
| thread_id vs conversation_id 命名混淆 | 在代码内统一为 thread_id，UI 文案可仍用"会话 ID" |