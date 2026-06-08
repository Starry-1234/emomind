import { useNavigate, useRouterState } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  type ConversationModuleType,
  useConversation,
} from "@/contexts/ConversationContext"

export type Item = {
  icon: LucideIcon
  title: string
  path: string
}

interface MainProps {
  items: Item[]
}

const MODULE_PATHS = new Set(["/user/ai-doctor", "/user/test"])

const MODULE_TYPES: Record<string, ConversationModuleType> = {
  "/user/ai-doctor": "ai-doctor",
  "/user/test": "test",
}

export function Main({ items }: MainProps) {
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouterState()
  const currentPath = router.location.pathname
  const navigate = useNavigate()
  const { allConversations, selectConversationById } = useConversation()

  const handleMenuClick = (item: Item) => {
    if (isMobile) {
      setOpenMobile(false)
    }

    // ── 心理医生 / 心理测评：有记录时跳转到最近更新的会话 ──────────────────
    if (MODULE_PATHS.has(item.path)) {
      const moduleType = MODULE_TYPES[item.path]
      const moduleConvs = allConversations.filter(
        (c) => c.moduleType === moduleType,
      )
      if (moduleConvs.length > 0) {
        const latest = moduleConvs[0]
        const routePath =
          moduleType === "ai-doctor"
            ? "/user/ai-doctor/chat/$sessionId"
            : "/user/test/chat/$sessionId"
        navigate({ to: routePath, params: { sessionId: latest.id } })
        selectConversationById(latest.id, moduleType)
        return
      }
      // 无记录 → 导航到基础路由（欢迎页）
      navigate({ to: item.path })
      return
    }

    // ── 普通导航项 ──────────────────────────────────────────────────────────
    navigate({ to: item.path })
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            // 首页（/user 或 /admin）使用精确匹配，避免子路径也高亮
            const isRoot = item.path === "/user" || item.path === "/admin"
            const isActive = isRoot
              ? currentPath === item.path
              : currentPath.startsWith(item.path)

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive}
                  asChild
                >
                  <button
                    type="button"
                    onClick={() => handleMenuClick(item)}
                    className="w-full"
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
