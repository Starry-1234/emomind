/**
 * V5 REST wrapper for ConversationMeta operations.
 * Spring routes these to ai-runtime's POST /v1/conversations etc.
 */
import type { Graph } from "./langgraphTypes"

export interface ConversationMeta {
  id: string
  graph: Graph
  thread_id: string
  title: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ""

function authHeaders(): HeadersInit {
  // Spring cookie auth; no X-Internal-Token here.
  return { "Content-Type": "application/json" }
}

export async function listConversations(
  userId: string,
  graph: Graph,
): Promise<ConversationMeta[]> {
  const qs = new URLSearchParams({ user_id: userId, graph })
  const r = await fetch(`${API_BASE}/api/v1/ai/conversations?${qs}`, {
    method: "GET",
    credentials: "include",
    headers: authHeaders(),
  })
  if (!r.ok) throw new Error(`listConversations failed: ${r.status}`)
  return (await r.json()) as ConversationMeta[]
}

export async function getConversation(
  userId: string,
  graph: Graph,
  threadId: string,
): Promise<ConversationMeta | null> {
  const qs = new URLSearchParams({
    user_id: userId,
    graph,
    thread_id: threadId,
  })
  const r = await fetch(`${API_BASE}/api/v1/ai/conversations?${qs}`, {
    method: "GET",
    credentials: "include",
    headers: authHeaders(),
  })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`getConversation failed: ${r.status}`)
  return (await r.json()) as ConversationMeta
}

export async function createConversation(
  _userId: string,
  graph: Graph,
  threadId: string,
  title?: string,
): Promise<ConversationMeta> {
  const r = await fetch(`${API_BASE}/api/v1/ai/conversations`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify({
      graph,
      thread_id: threadId,
      title: title ?? null,
      metadata: {},
    }),
  })
  if (!r.ok) throw new Error(`createConversation failed: ${r.status}`)
  return (await r.json()) as ConversationMeta
}
