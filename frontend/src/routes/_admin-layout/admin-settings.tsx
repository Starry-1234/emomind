import { createFileRoute } from "@tanstack/react-router"

import ChangePassword from "@/components/UserSettings/ChangePassword"
import DeleteAccount from "@/components/UserSettings/DeleteAccount"
import UserInformation from "@/components/UserSettings/UserInformation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useAuth from "@/hooks/useAuth"

const tabsConfig = [
  { value: "my-profile", title: "个人信息", component: UserInformation },
  { value: "password", title: "密码", component: ChangePassword },
  { value: "danger-zone", title: "危险区域", component: DeleteAccount },
]

export const Route = createFileRoute("/_admin-layout/admin-settings")({
  component: UserSettings,
  head: () => ({
    meta: [
      {
        title: "设置 - 心理测评系统",
      },
    ],
  }),
})

function UserSettings() {
  const { user: currentUser } = useAuth()
  const finalTabs = currentUser?.is_superuser
    ? tabsConfig.slice(0, 3)
    : tabsConfig

  if (!currentUser) {
    return null
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <div>
        <h1 className="font-serif-zh text-2xl font-semibold tracking-tight">
          用户设置
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理您的账户设置和偏好
        </p>
      </div>

      <Tabs defaultValue="my-profile">
        <TabsList className="bg-secondary/60">
          {finalTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {finalTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <tab.component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
