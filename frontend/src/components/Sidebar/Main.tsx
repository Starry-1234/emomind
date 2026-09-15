/**
 * M5 — V5 Main menu: routes plain navigation only.
 *
 * M1-era Main redirected to "latest conversation" when the user clicked on a
 * module item (ai-doctor / test). M5 splits that behavior: the navigation
 * menu just routes; the conversation list itself (see ConversationList.tsx)
 * is responsible for showing the latest items.
 *
 * The chat-history browser is wired through useChatHistory on the
 * ConversationList side. Clicking an ai-doctor / test menu item from the
 * sidebar just navigates to the welcome page (which already shows the
 * conversation list under the hood).
 */
import { useNavigate, useRouterState } from "@tanstack/react-router"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export type Item = {
  icon: React.ElementType
  title: string
  path: string
}

interface MainProps {
  items: Item[]
}

export function Main({ items }: MainProps) {
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouterState()
  const currentPath = router.location.pathname
  const navigate = useNavigate()

  const handleMenuClick = (item: Item) => {
    if (isMobile) setOpenMobile(false)
    navigate({ to: item.path })
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            // Home (e.g. /user or /admin) uses exact match so child paths
            // don't highlight it; everything else uses prefix match.
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
