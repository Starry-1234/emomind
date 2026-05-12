import { ClipboardList, Home, MessageSquare, Users } from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type Item, Main } from "./Main"
import { User } from "./User"

const adminItems: Item[] = [
  { icon: Home, title: "首页", path: "/admin" },
  { icon: Users, title: "用户管理", path: "/user-manage" },
  { icon: MessageSquare, title: "用户会话记录", path: "/chat-history" },
  { icon: ClipboardList, title: "用户测评记录", path: "/admin-test-records" },
]

export function AppSidebar() {
  // 管理员侧边栏使用 /admin/* 路径
  const items = adminItems
  const { user: currentUser } = useAuth()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
