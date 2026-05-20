import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { ApiError, type UserPublic, UsersService } from "@/client"
import { Footer } from "@/components/Common/Footer"
import { ConversationProvider } from "@/components/contexts/ConversationContext"
import UserSidebar from "@/components/Sidebar/UserSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/user")({
  component: UserLayout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
    let user: UserPublic | undefined
    try {
      user = await UsersService.readUserMe()
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        localStorage.removeItem("access_token")
      }
      throw redirect({ to: "/login" })
    }
    if (user.is_superuser) {
      throw redirect({
        to: "/admin",
      })
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
