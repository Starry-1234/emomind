/**
 * Cancel an in-flight ai-runtime chat by setting the Redis cancel flag
 * via ai-runtime's POST /v1/conversations/{threadId}/cancel.
 *
 * Called from useChat's stop() on browser tab close, abort, or
 * explicit "Stop" button. Spring's AiController.cancel proxies
 * through to ai-runtime (M5 T3).
 */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ""
const INTERNAL_TOKEN = "test-internal-token-32-chars-long-pad" // M5: use real auth flow; placeholder for now

export async function cancelChat(threadId: string): Promise<void> {
  await fetch(`${API_BASE}/v1/conversations/${threadId}/cancel`, {
    method: "POST",
    credentials: "include",
    headers: { "X-Internal-Token": INTERNAL_TOKEN },
  })
  // Status code is ignored: best-effort. The AbortController on the
  // SSE side closes the connection; the Redis flag is the durable signal.
}
