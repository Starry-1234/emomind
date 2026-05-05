import { useNavigate, useRouterState } from "@tanstack/react-router"
import { MessageSquare, Plus, X } from "lucide-react"

import { useConversation } from "@/components/contexts/ConversationContext"
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function ConversationList() {
  const {
    conversations,
    activeConvId,
    selectConversation,
    deleteConversationById,
    newConversation,
  } = useConversation()

  const { isMobile, setOpenMobile } = useSidebar()
  const navigate = useNavigate()
  const router = useRouterState()
  const currentPath = router.location.pathname

  const handleNewConversation = () => {
    newConversation()
    // 如果不在 ai-doctor 页，跳转过去
    if (currentPath !== "/user/ai-doctor") {
      navigate({ to: "/user/ai-doctor" })
    }
  }

  const handleSelectConversation = (convId: string) => {
    selectConversation(convId)
    // 跳转到 ai-doctor 页面加载该会话
    if (currentPath !== "/user/ai-doctor") {
      navigate({ to: "/user/ai-doctor" })
    }
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleDeleteConversation = async (
    convId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()
    await deleteConversationById(convId)
  }

  return (
    <SidebarGroup className="group/conversation">
      <SidebarGroupLabel>会话记录</SidebarGroupLabel>
      <SidebarGroupAction onClick={handleNewConversation} title="新建会话">
        <Plus />
      </SidebarGroupAction>
      <SidebarGroupContent className="max-h-60 overflow-y-auto">
        <SidebarMenu>
          {conversations.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              暂无会话记录
            </div>
          ) : (
            conversations.map((conv) => (
              <SidebarMenuItem key={conv.id}>
                <SidebarMenuButton
                  tooltip={conv.name || "新对话"}
                  isActive={activeConvId === conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <MessageSquare />
                  <span className="truncate">{conv.name || "新对话"}</span>
                </SidebarMenuButton>
                <SidebarMenuAction
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                >
                  <X />
                </SidebarMenuAction>
              </SidebarMenuItem>
            ))
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
