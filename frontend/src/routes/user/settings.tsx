import { createFileRoute } from "@tanstack/react-router"

import ChangePassword from "@/components/UserSettings/ChangePassword"
import DeleteAccount from "@/components/UserSettings/DeleteAccount"
import UserInformation from "@/components/UserSettings/UserInformation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useAuth from "@/hooks/useAuth"

const tabsConfig = [
  { value: "my-profile", title: "个人信息", component: UserInformation },
  { value: "password", title: "修改密码", component: ChangePassword },
  { value: "danger-zone", title: "危险操作", component: DeleteAccount },
]

export const Route = createFileRoute("/user/settings")({
  component: UserSettings,
  head: () => ({
    meta: [
      {
        title: "用户设置",
      },
    ],
  }),
})

function UserSettings() {
  const { user: currentUser } = useAuth()

  if (!currentUser) {
    return null
  }

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 p-6 md:p-8">
      <div>
        <h1 className="font-serif-zh text-2xl font-semibold tracking-tight">
          用户设置
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理您的账户信息与偏好设置
        </p>
      </div>

      <Tabs defaultValue="my-profile">
        <TabsList className="bg-secondary/60">
          {tabsConfig.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabsConfig.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <tab.component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
