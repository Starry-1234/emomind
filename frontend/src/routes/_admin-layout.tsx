import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { ApiError, type UserResponse, UsersService } from "@/client"
import { Footer } from "@/components/Common/Footer"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ConversationProvider } from "@/contexts/ConversationContext"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_admin-layout")({
  component: AdminLayout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
    let user: UserResponse | undefined
    try {
      user = await UsersService.getCurrentUser()
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        localStorage.removeItem("access_token")
      }
      throw redirect({ to: "/login" })
    }
    if (!user.is_superuser) {
      throw redirect({
        to: "/user",
      })
    }
  },
})

export default function AdminLayout() {
  return (
    <ConversationProvider>
      <SidebarProvider className="h-full flex">
        <AppSidebar />
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
