/**
 * LangGraph SSE event types — matches the wire protocol defined in
 * doc/langgraph-migration/02-components.md §1.1 SSE events.
 */

export type LangGraphRole = "user" | "assistant"

export interface LangGraphFile {
  file_id: string
  url: string
  mime: string
  size: number
  name?: string
  category?: "image" | "audio" | "video" | "doc"
}

export interface LangGraphMessage {
  role: LangGraphRole
  content: string
  files?: LangGraphFile[]
  isStreaming?: boolean
  threadId?: string
  runId?: string
}

export interface LangGraphConversation {
  threadId: string
  graph: "ai-doctor" | "psych-test"
  title?: string
  createdAt: string
  updatedAt: string
}

export interface StreamCallbacks {
  onRunStart?: (threadId: string, runId: string, graph: string) => void
  onNodeStart?: (nodeName: string) => void
  onToken?: (delta: string) => void
  onToolCall?: (name: string, args: Record<string, unknown>) => void
  onMessageEnd?: (
    threadId: string,
    runId: string,
    fullContent: string,
    files?: LangGraphFile[],
  ) => void
  onWorkflowEvent?: (type: string, payload: unknown) => void
  onError?: (code: string, message: string, recoverable: boolean) => void
}

export interface ChatStreamOptions {
  threadId?: string
  signal?: AbortSignal
}
