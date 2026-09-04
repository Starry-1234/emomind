/**
 * M5 T7 — React Query wrapper over the V5 REST conversation list.
 *
 * Backed by `conversationApi.listConversations(userId, graph)` from
 * `services/conversationApi.ts`. The query key is keyed by userId + graph
 * so the cache naturally partitions across users and graphs.
 *
 * Returns:
 *   - conversations: ConversationMeta[]  (empty array while loading / on error)
 *   - isLoading: boolean
 *   - error: Error | null
 *   - refresh: () => void   (manually invalidate the list query)
 *   - create: (input: { threadId: string; title?: string })
 *             => Promise<ConversationMeta>
 *             (uses useMutation; invalidates the list on success so the UI
 *              refreshes without an extra round-trip)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  type ConversationMeta,
  createConversation,
  listConversations,
} from "@/services/conversationApi"
import type { Graph } from "@/services/langgraphTypes"

export interface CreateConversationInput {
  threadId: string
  title?: string
}

export interface UseChatHistoryReturn {
  conversations: ConversationMeta[]
  isLoading: boolean
  error: Error | null
  refresh: () => void
  create: (input: CreateConversationInput) => Promise<ConversationMeta>
}

export function useChatHistory(
  userId: string,
  graph: Graph,
): UseChatHistoryReturn {
  const qc = useQueryClient()
  const key = ["conversations", userId, graph] as const

  const list = useQuery({
    queryKey: key,
    queryFn: () => listConversations(userId, graph),
    enabled: !!userId,
  })

  const create = useMutation({
    mutationFn: (input: CreateConversationInput) =>
      createConversation(userId, graph, input.threadId, input.title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })

  return {
    conversations: list.data ?? [],
    isLoading: list.isLoading,
    error: list.error as Error | null,
    refresh: () => {
      qc.invalidateQueries({ queryKey: key })
    },
    create: (input: CreateConversationInput) => create.mutateAsync(input),
  }
}
