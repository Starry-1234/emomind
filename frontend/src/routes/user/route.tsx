import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { Footer } from "@/components/Common/Footer"
import { ConversationProvider } from "@/components/contexts/ConversationContext"
import UserSidebar from "@/components/Sidebar/UserSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { isLoggedIn } from "@/hooks/useAuth"
import { UsersService } from "@/client"

export const Route = createFileRoute("/user")({
  component: UserLayout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
    try {
      // 验证是否为普通用户（非超管）
      const user = await UsersService.readUserMe()
      if (user.is_superuser) {
        throw redirect({
          to: "/admin",
        })
      }
    } catch (error) {
      // Token 无效或过期，清除 token 并重定向到登录页
      localStorage.removeItem("access_token")
      throw redirect({ to: "/login" })
    }
  },
})

export default function UserLayout() {
  return (
    <ConversationProvider>
      <SidebarProvider>
        <UserSidebar />
        <SidebarInset className="flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1 text-muted-foreground" />
          </header>
          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>
          <Footer />
        </SidebarInset>
      </SidebarProvider>
    </ConversationProvider>
  )
}
