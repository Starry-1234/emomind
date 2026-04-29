import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_admin-layout/admin")({
  component: AdminHome,
  head: () => ({
    meta: [
      {
        title: "管理后台首页",
      },
    ],
  }),
})

function AdminHome() {
  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <h1 className="text-3xl font-bold">管理后台</h1>
      <p className="text-muted-foreground">欢迎使用心理测评系统管理后台</p>
    </div>
  )
}