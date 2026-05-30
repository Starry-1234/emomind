import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ClipboardCheck, FileText, MessageSquare, Users } from "lucide-react"
import { AdminService } from "@/client"
import type { AdminStatsResponse } from "@/client"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"

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

async function fetchAdminStats(): Promise<AdminStatsResponse> {
  return AdminService.getStats()
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  subColor = "text-muted-foreground",
  accentColor,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  subValue?: string
  subColor?: string
  accentColor: string
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${accentColor}`}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subValue && <p className={`text-xs ${subColor}`}>{subValue}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function AdminHome() {
  const { user } = useAuth()

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
    refetchInterval: 30000,
  })

  const today = new Date()
  const dateStr = today.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })

  return (
    <div className="mx-auto max-w-6xl flex flex-col gap-6 p-6 md:p-8">
      {/* 顶部问候 */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="mr-2">👋</span>管理后台
        </h1>
        <p className="text-muted-foreground text-sm">{dateStr}</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Users}
          label="总用户数"
          value={isLoading ? "--" : (stats?.total_users ?? 0)}
          subValue={`今日新增 ${stats?.today_new_users ?? 0} 人`}
          subColor={
            stats?.today_new_users && stats.today_new_users > 0
              ? "text-emerald-600"
              : "text-muted-foreground"
          }
          accentColor="bg-blue-50 text-blue-600"
        />

        <StatCard
          icon={ClipboardCheck}
          label="测评记录总数"
          value={isLoading ? "--" : (stats?.total_test_records ?? 0)}
          subValue={`今日新增 ${stats?.today_new_test_records ?? 0} 条`}
          subColor={
            stats?.today_new_test_records && stats.today_new_test_records > 0
              ? "text-emerald-600"
              : "text-muted-foreground"
          }
          accentColor="bg-violet-50 text-violet-600"
        />

        <StatCard
          icon={FileText}
          label="分析报告总数"
          value={isLoading ? "--" : (stats?.total_analysis_reports ?? 0)}
          accentColor="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* 快捷入口 */}
      <div>
        <h2 className="text-base font-semibold mb-3">快捷入口</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link to="/user-manage">
            <Card className="hover:shadow-md transition-shadow group relative overflow-hidden">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Users className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">用户管理</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    查看和管理所有注册用户
                  </p>
                </div>
                <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-blue-50 opacity-0 transition-opacity group-hover:opacity-100" />
              </CardContent>
            </Card>
          </Link>

          <Link to="/chat-history">
            <Card className="hover:shadow-md transition-shadow group relative overflow-hidden">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <MessageSquare className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">用户会话记录</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    查看用户的 AI 咨询会话
                  </p>
                </div>
                <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-violet-50 opacity-0 transition-opacity group-hover:opacity-100" />
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin-test-records">
            <Card className="hover:shadow-md transition-shadow group relative overflow-hidden">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <ClipboardCheck className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">用户测评记录</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    查看用户的测评记录与报告
                  </p>
                </div>
                <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-amber-50 opacity-0 transition-opacity group-hover:opacity-100" />
              </CardContent>
            </Card>
          </Link>

          <a
            href="http://localhost:8080/swagger-ui.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Card className="hover:shadow-md transition-shadow group relative overflow-hidden">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <FileText className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">API 文档</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    查看后端 API 接口文档
                  </p>
                </div>
                <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-emerald-50 opacity-0 transition-opacity group-hover:opacity-100" />
              </CardContent>
            </Card>
          </a>
        </div>
      </div>

      {/* 管理员信息 */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex items-start gap-3 py-4">
          <span className="text-xl">🔐</span>
          <div>
            <p className="text-sm font-medium text-foreground/80">当前管理员</p>
            <p className="mt-1 text-base text-foreground/60">
              {user?.email || "admin@emomind.com"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
