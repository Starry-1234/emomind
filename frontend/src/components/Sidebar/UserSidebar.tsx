import { Home, Brain, History, MessageSquare, Stethoscope } from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { ConversationList } from "./ConversationList"
import { type Item, Main } from "./Main"
import { User } from "./User"

const userItems: Item[] = [
  { icon: Home, title: "首页", path: "/user" },
  { icon: Stethoscope, title: "智能心理医生", path: "/user/ai-doctor" },
  { icon: Brain, title: "心理测评", path: "/user/test" },
  { icon: History, title: "测评记录", path: "/user/history" },
  { icon: MessageSquare, title: "咨询记录", path: "/user/consultations" },
]

export function UserSidebar() {
  const items = userItems
  const { user: currentUser } = useAuth()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
        <ConversationList />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default UserSidebar
