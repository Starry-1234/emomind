/**
 * M5 T7 — typed React Context for the active chat selection.
 *
 * Replaces the M1-era Dify-shaped conversation list (allConversations,
 * activeConvId, selectConversationById, etc.) with the minimal V5 shape:
 * the currently-signed-in user, the user's selected thread_id, and the
 * resolved conversation_id, scoped to the active graph.
 *
 * - currentUserId is seeded from useAuth() by the Provider's caller
 *   (typically the layout route, after the login redirect).
 * - selectedThreadId and currentConversationId are local UI state so the
 *   chat-history browser can drive the active conversation without
 *   re-routing.
 * - currentGraph + setCurrentGraph let a page switch graphs (e.g. between
 *   "ai-doctor" and "psych-test") without remounting the Provider.
 *
 * Consumers should call `useConversation()` to read the shape below.
 */
import { createContext, type ReactNode, useContext, useState } from "react"

import type { Graph } from "@/services/langgraphTypes"

interface ConversationContextValue {
  currentUserId: string | null
  selectedThreadId: string | null
  setSelectedThreadId: (id: string | null) => void
  currentConversationId: string | null
  setCurrentConversationId: (id: string | null) => void
  currentGraph: Graph
  setCurrentGraph: (g: Graph) => void
}

const ConversationContext = createContext<ConversationContextValue | null>(null)

export function ConversationProvider({
  userId,
  graph,
  children,
}: {
  userId: string | null
  graph: Graph
  children: ReactNode
}) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null)
  const [currentGraph, setCurrentGraph] = useState<Graph>(graph)

  return (
    <ConversationContext.Provider
      value={{
        currentUserId: userId,
        selectedThreadId,
        setSelectedThreadId,
        currentConversationId,
        setCurrentConversationId,
        currentGraph,
        setCurrentGraph,
      }}
    >
      {children}
    </ConversationContext.Provider>
  )
}

export function useConversation(): ConversationContextValue {
  const ctx = useContext(ConversationContext)
  if (!ctx) {
    throw new Error(
      "useConversation must be used inside <ConversationProvider>",
    )
  }
  return ctx
}
