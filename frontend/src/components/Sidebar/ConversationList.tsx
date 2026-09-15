/**
 * M5 — V5 ConversationList, scoped to the active graph from ConversationContext.
 *
 * M1-era ConversationList showed all conversations and grouped them by
 * moduleType ("ai-doctor" vs "test") with a single badge per row. M5 splits
 * that: each layout (user / admin) wraps in <ConversationProvider graph="…">
 * and ConversationList now only lists that provider's graph.
 *
 * Notes:
 *   - We do not delete on click; the new backend exposes
 *     DELETE /api/v1/ai/conversations/{thread_id} which is wired in ai-runtime
 *     but not yet through conversationApi. M5 keeps the delete affordance
 *     stubbed — disabling the X button — and the implementation lands in
 *     M6 when ai-runtime ships the message-load endpoint.
 *   - We use useChatHistory(userId, graph) for the cached list; the V5 list
 *     returns ConversationMeta[] (flat, no discriminator).
 */
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { Loader2, Plus } from "lucide-react"
import { useState } from "react"
import { SealIcon } from "@/components/Common/SealIcon"
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useConversation } from "@/contexts/ConversationContext"
import useAuth from "@/hooks/useAuth"
import { useChatHistory } from "@/hooks/useChatHistory"

const ROUTE_FOR_GRAPH: Record<"ai-doctor" | "psych-test", string> = {
  "ai-doctor": "/user/ai-doctor/chat/$sessionId",
  "psych-test": "/user/test/chat/$sessionId",
}

export function ConversationList() {
  const { currentGraph, selectedThreadId, setSelectedThreadId } =
    useConversation()
  const { user } = useAuth()
  const userId = user?.id ? String(user.id) : ""
  const { isMobile, setOpenMobile } = useSidebar()
  const navigate = useNavigate()
  const router = useRouterState()
  const currentPath = router.location.pathname

  const { conversations, isLoading } = useChatHistory(userId, currentGraph)
  // M6: wire up real deleteConversation(threadId) when ai-runtime ships it.
  const [deletingId] = useState<string | null>(null)

  const baseRoute =
    currentGraph === "psych-test" ? "/user/test" : "/user/ai-doctor"
  const chatRoute = ROUTE_FOR_GRAPH[currentGraph]

  const handleNewConversation = () => {
    setSelectedThreadId(null)
    navigate({ to: baseRoute })
    if (isMobile) setOpenMobile(false)
  }

  const handleSelectConversation = (threadId: string) => {
    setSelectedThreadId(threadId)
    navigate({ to: chatRoute, params: { sessionId: threadId } })
    if (isMobile) setOpenMobile(false)
  }

  const isCurrent = (threadId: string) =>
    currentPath.includes(`/chat/${threadId}`) || selectedThreadId === threadId

  return (
    <SidebarGroup className="group/conversation">
      <SidebarGroupLabel>会话记录</SidebarGroupLabel>
      <SidebarGroupAction onClick={handleNewConversation} title="新建会话">
        <Plus />
      </SidebarGroupAction>
      <SidebarGroupContent className="max-h-[50vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center px-2 py-3 text-xs text-muted-foreground">
            <Loader2 className="mr-1.5 size-3 animate-spin" />
            加载中…
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            暂无会话记录
          </div>
        ) : (
          <SidebarMenu>
            {conversations.map((conv) => (
              <SidebarMenuItem key={conv.thread_id}>
                <SidebarMenuButton
                  tooltip={conv.title || "新对话"}
                  isActive={isCurrent(conv.thread_id)}
                  onClick={() => handleSelectConversation(conv.thread_id)}
                >
                  <SealIcon char="话" />
                  <span className="truncate flex-1">
                    {conv.title || "新对话"}
                  </span>
                  {/* M6: wire up deleteConversation(conv.thread_id) once
                      ai-runtime ships it. Until then, the X button is hidden. */}
                  {deletingId === conv.thread_id && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
