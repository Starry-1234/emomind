/**
 * langgraphApi — replaces difyApi.ts for the ai_doctor (and later psych-test) graphs.
 *
 * The Spring gateway at /api/v1/ai/chat accepts JSON, returns text/event-stream
 * SSE. We use fetch + AbortSignal (the EventSource API doesn't support custom
 * headers or POST bodies).
 */
import { parseSseStream } from "@/lib/sseParser"
import type {
  ChatStreamOptions,
  LangGraphMessage,
  StreamCallbacks,
} from "./langgraphTypes"

const API_BASE = import.meta.env.VITE_API_URL || ""

interface ChatRequestBody {
  graph: "ai-doctor" | "psych-test"
  thread_id?: string
  input: {
    messages: LangGraphMessage[]
    files?: unknown[]
  }
}

export async function sendChatStream(
  graph: "ai-doctor" | "psych-test",
  input: { messages: LangGraphMessage[]; files?: unknown[] },
  callbacks: StreamCallbacks,
  options: ChatStreamOptions = {},
): Promise<void> {
  const body: ChatRequestBody = {
    graph,
    thread_id: options.threadId,
    input,
  }

  const res = await fetch(`${API_BASE}/api/v1/ai/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  })

  if (!res.ok || !res.body) {
    callbacks.onError?.(
      "HTTP_ERROR",
      `chat request failed: ${res.status} ${res.statusText}`,
      res.status >= 500,
    )
    return
  }

  for await (const frame of parseSseStream(res.body)) {
    let payload: Record<string, unknown> = {}
    try {
      payload = frame.data ? JSON.parse(frame.data) : {}
    } catch {
      // Ignore malformed JSON; treat as empty payload.
    }

    switch (frame.event) {
      case "run_start":
        callbacks.onRunStart?.(
          String(payload.thread_id ?? ""),
          String(payload.run_id ?? ""),
          String(payload.graph ?? graph),
        )
        break
      case "node_start":
        callbacks.onNodeStart?.(String(payload.name ?? ""))
        break
      case "token":
        callbacks.onToken?.(String(payload.delta ?? ""))
        break
      case "tool_call":
        callbacks.onToolCall?.(
          String(payload.name ?? ""),
          (payload.args as Record<string, unknown>) ?? {},
        )
        break
      case "message_end":
        callbacks.onMessageEnd?.(
          String(payload.thread_id ?? ""),
          String(payload.run_id ?? ""),
          String(payload.full_content ?? ""),
          (payload.files as never[]) ?? undefined,
        )
        break
      case "workflow_event":
        callbacks.onWorkflowEvent?.(String(payload.type ?? ""), payload.payload)
        break
      case "error":
        callbacks.onError?.(
          String(payload.code ?? "UNKNOWN"),
          String(payload.message ?? ""),
          Boolean(payload.recoverable),
        )
        break
      default:
        // unknown event type — ignore
        break
    }
  }
}

/**
 * Stop a running chat. M1: sends AbortSignal-like cancel to Spring; Spring's
 * M1 AiController just returns 200 (no-op). M5 will wire Redis-backed cancel
 * via ai-runtime's /v1/chat/stop.
 */
export async function stopChat(threadId: string, runId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/ai/chat/stop`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: threadId, run_id: runId }),
    })
  } catch {
    // Best-effort; the actual stream is aborted via AbortSignal at the call site.
  }
}
