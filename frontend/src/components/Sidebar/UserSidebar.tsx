import { SealIcon } from "@/components/Common/SealIcon"
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
  { icon: () => <SealIcon char="首" />, title: "首页", path: "/user" },
  { icon: () => <SealIcon char="医" />, title: "智能心理医生", path: "/user/ai-doctor" },
  { icon: () => <SealIcon char="测" />, title: "智能心理测评", path: "/user/test" },
  { icon: () => <SealIcon char="记" />, title: "测评报告历史", path: "/user/test-records" },
  { icon: () => <SealIcon char="档" />, title: "咨询报告历史", path: "/user/consultations" },
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
