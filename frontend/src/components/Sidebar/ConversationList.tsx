import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { Brain, Loader2, MessageSquare, Plus, Stethoscope, X } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
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
import {
  type ConversationModuleType,
  type TypedConversation,
  useConversation,
} from "@/contexts/ConversationContext"
import useAuth from "@/hooks/useAuth"

// ── 模块路由配置：根据 moduleType 解析对应的 chat 路由和 modulePath ──────────
const MODULE_ROUTES: Record<
  ConversationModuleType,
  { chatRoute: string; modulePath: string }
> = {
  "ai-doctor": {
    chatRoute: "/user/ai-doctor/chat/$sessionId",
    modulePath: "/user/ai-doctor",
  },
  test: { chatRoute: "/user/test/chat/$sessionId", modulePath: "/user/test" },
}

export function ConversationList() {
  const {
    allConversations,
    selectConversationById,
    deleteConversationById,
    modulePath,
  } = useConversation()

  const { user } = useAuth()
  const userId = user?.id || "anonymous"
  const { isMobile, setOpenMobile } = useSidebar()
  const navigate = useNavigate()
  const router = useRouterState()
  const currentPath = router.location.pathname
  // 正在删除中的会话 ID
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 从当前 URL 中提取 sessionId（如果处于动态路由中）
  const sessionMatch = currentPath.match(
    /\/user\/(?:ai-doctor|test)\/chat\/([^/]+)/,
  )
  const currentSessionId = sessionMatch ? sessionMatch[1] : ""

  // 按模块类型分组
  const doctorConversations = allConversations.filter(
    (c) => c.moduleType === "ai-doctor",
  )
  const testConversations = allConversations.filter(
    (c) => c.moduleType === "test",
  )

  const handleNewConversation = () => {
    const moduleType: ConversationModuleType = modulePath.startsWith(
      "/user/test",
    )
      ? "test"
      : "ai-doctor"

    // 清除基础路由的 sessionStorage 缓存，确保显示干净的模板页面
    // key 格式：emomind_chat_messages_${userId}_new / emomind_test_messages_${userId}_new
    const cachePrefix =
      moduleType === "test" ? "emomind_test_messages" : "emomind_chat_messages"
    sessionStorage.removeItem(`${cachePrefix}_${userId}_new`)

    navigate({ to: modulePath })
    selectConversationById("", moduleType)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleSelectConversation = (conv: TypedConversation) => {
    const route = MODULE_ROUTES[conv.moduleType]
    navigate({ to: route.chatRoute, params: { sessionId: conv.id } })
    selectConversationById(conv.id, conv.moduleType)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleDeleteConversation = async (
    convId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()
    if (deletingId) return // 防止重复点击

    // 先判断是否需要导航（在 deleteConversationById 可能失败的情况下也要导航）
    const isTest = currentPath.startsWith("/user/test")
    const isCurrentConv = currentSessionId === convId
    const targetPath = isTest ? "/user/test" : "/user/ai-doctor"

    // 如果被删的是当前正在查看的会话，先导航到基础路由再删除
    // 这样无论 API 是否成功，用户都不会停留在已删除的会话页面
    if (isCurrentConv) {
      navigate({ to: targetPath, replace: true })
    }

    setDeletingId(convId)
    try {
      await deleteConversationById(convId)
    } catch (err) {
      alert(`删除失败: ${err instanceof Error ? err.message : "未知错误"}`)
    } finally {
      setDeletingId(null)
    }
  }

  // 渲染单条会话
  const renderConversationItem = (conv: TypedConversation) => (
    <SidebarMenuItem key={conv.id}>
      <SidebarMenuButton
        tooltip={conv.name || "新对话"}
        isActive={currentSessionId === conv.id}
        onClick={() => handleSelectConversation(conv)}
      >
        <MessageSquare className="size-4" />
        <span className="truncate flex-1">{conv.name || "新对话"}</span>
        <Badge
          variant="outline"
          className={`ml-1 shrink-0 text-[10px] leading-none px-1.5 py-0.5 ${
            conv.moduleType === "ai-doctor"
              ? "border-primary/30 text-primary"
              : "border-primary/30 text-primary"
          }`}
        >
          {conv.moduleType === "ai-doctor" ? "医生" : "测评"}
        </Badge>
      </SidebarMenuButton>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <SidebarMenuAction
            onClick={(e) => e.stopPropagation()}
            disabled={deletingId === conv.id}
          >
            {deletingId === conv.id ? (
              <Loader2 className="animate-spin" />
            ) : (
              <X />
            )}
          </SidebarMenuAction>
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除会话「{conv.name || "新对话"}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                handleDeleteConversation(conv.id, e)
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenuItem>
  )

  return (
    <SidebarGroup className="group/conversation">
      <SidebarGroupLabel>会话记录</SidebarGroupLabel>
      <SidebarGroupAction onClick={handleNewConversation} title="新建会话">
        <Plus />
      </SidebarGroupAction>
      <SidebarGroupContent className="max-h-[50vh] overflow-y-auto">
        {allConversations.length === 0 ? (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            暂无会话记录
          </div>
        ) : (
          <div className="space-y-1">
            {/* 咨询记录分组 */}
            {doctorConversations.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
                  <Stethoscope className="size-3 text-primary" />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    咨询记录
                  </span>
                </div>
                <SidebarMenu>
                  {doctorConversations.map(renderConversationItem)}
                </SidebarMenu>
              </div>
            )}

            {/* 测评记录分组 */}
            {testConversations.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
                  <Brain className="size-3 text-primary" />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    测评记录
                  </span>
                </div>
                <SidebarMenu>
                  {testConversations.map(renderConversationItem)}
                </SidebarMenu>
              </div>
            )}
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
