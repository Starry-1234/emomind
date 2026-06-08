import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { SealIcon } from "@/components/Common/SealIcon"
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
    <Card className="memo-card rounded-lg transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-md ${accentColor}`}
        >
          <Icon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="font-serif-zh text-2xl font-semibold">{value}</p>
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
    <div className="ink-wash-bg mx-auto max-w-6xl flex flex-col gap-8 p-6 md:p-10">
      {/* 顶部问候 */}
      <header className="animate-fade-in-up">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {dateStr}
        </p>
        <h1 className="font-serif-zh text-3xl font-semibold tracking-tight text-foreground">
          管理后台
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          系统运行概览与用户数据
        </p>
      </header>

      {/* 统计卡片 */}
      <section className="animate-fade-in-up delay-100 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={() => <SealIcon char="户" size="lg" />}
          label="总用户数"
          value={isLoading ? "--" : (stats?.total_users ?? 0)}
          subValue={`今日新增 ${stats?.today_new_users ?? 0} 人`}
          subColor={
            stats?.today_new_users && stats.today_new_users > 0
              ? "text-[#5a7a6a]"
              : "text-muted-foreground"
          }
          accentColor="bg-[#2d4a3e]/8 text-[#2d4a3e]"
        />

        <StatCard
          icon={() => <SealIcon char="录" size="lg" />}
          label="测评记录总数"
          value={isLoading ? "--" : (stats?.total_test_records ?? 0)}
          subValue={`今日新增 ${stats?.today_new_test_records ?? 0} 条`}
          subColor={
            stats?.today_new_test_records && stats.today_new_test_records > 0
              ? "text-[#5a7a6a]"
              : "text-muted-foreground"
          }
          accentColor="bg-[#8b7355]/10 text-[#8b7355]"
        />

        <StatCard
          icon={() => <SealIcon char="档" size="lg" />}
          label="分析报告总数"
          value={isLoading ? "--" : (stats?.total_analysis_reports ?? 0)}
          accentColor="bg-[#c45a43]/8 text-[#c45a43]"
        />
      </section>

      {/* 快捷入口 */}
      <section className="animate-fade-in-up delay-200">
        <h2 className="font-serif-zh text-base font-semibold mb-3">
          快捷入口
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              to: "/user-manage",
              icon: () => <SealIcon char="户" size="lg" />,
              title: "用户管理",
              desc: "查看和管理所有注册用户",
              tone: "primary" as const,
            },
            {
              to: "/chat-history",
              icon: () => <SealIcon char="话" size="lg" />,
              title: "用户会话记录",
              desc: "查看用户的 AI 咨询会话",
              tone: "secondary" as const,
            },
            {
              to: "/admin-test-records",
              icon: () => <SealIcon char="录" size="lg" />,
              title: "用户测评记录",
              desc: "查看用户的测评记录与报告",
              tone: "accent" as const,
            },
            {
              href: "http://localhost:8080/swagger-ui.html",
              icon: () => <SealIcon char="文" size="lg" />,
              title: "API 文档",
              desc: "查看后端 API 接口文档",
              tone: "muted" as const,
            },
          ].map((item) => {
            const inner = (
              <Card className="memo-card group relative overflow-hidden rounded-lg transition-all hover:shadow-md">
                <CardContent className="flex items-center gap-3 p-4">
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-md ${
                      item.tone === "primary"
                        ? "bg-[#2d4a3e]/8 text-[#2d4a3e] group-hover:bg-[#2d4a3e] group-hover:text-[#f7f4ef]"
                        : item.tone === "secondary"
                        ? "bg-[#8b7355]/10 text-[#8b7355] group-hover:bg-[#8b7355] group-hover:text-[#f7f4ef]"
                        : item.tone === "accent"
                        ? "bg-[#c45a43]/8 text-[#c45a43] group-hover:bg-[#c45a43] group-hover:text-white"
                        : "bg-secondary text-muted-foreground"
                    } transition-colors`}
                  >
                    <item.icon />
                  </div>
                  <div>
                    <CardTitle className="font-serif-zh text-sm">
                      {item.title}
                    </CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
            return "href" in item ? (
              <a
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            ) : (
              <Link key={item.title} to={item.to}>
                {inner}
              </Link>
            )
          })}
        </div>
      </section>

      {/* 管理员信息 */}
      <section className="animate-fade-in-up delay-300">
        <Card className="memo-card rounded-lg border-l-4 border-l-[#2d4a3e]">
          <CardContent className="flex items-start gap-3 py-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#2d4a3e]/8 text-[#2d4a3e]">
              <span className="font-serif-zh text-sm font-bold">管</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground/80">
                当前管理员
              </p>
              <p className="mt-0.5 text-base text-foreground/60">
                {user?.email || "admin@emomind.com"}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
