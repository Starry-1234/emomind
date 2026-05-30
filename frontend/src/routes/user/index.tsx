import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Brain,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  MessageSquare,
  Stethoscope,
  TrendingUp,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { TestRecordsService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"
import { getConversationCount, getConversations } from "@/services/difyApi"

export const Route = createFileRoute("/user/")({
  component: UserHome,
  head: () => ({
    meta: [{ title: "用户中心" }],
  }),
})

// ===== 每日一言 =====
const DAILY_QUOTES = [
  "寻求帮助不是软弱的表现，而是勇敢迈出的第一步。",
  "你不需要等到完美，才值得被善待。",
  "每一次深呼吸，都是对自己的温柔。",
  "承认脆弱，恰恰是内心强大的证明。",
  "你此刻的感受是真实的，也是值得被关注的。",
  "改变不必从明天开始，此刻就可以。",
  "允许自己休息，不是偷懒，而是自我照顾。",
  "黑暗中的每一步，都在靠近光明。",
  "你的存在本身就是有意义的。",
  "不必假装坚强，真实的你更值得被爱。",
]

function getQuoteOfTheDay() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      86400000,
  )
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length]
}

// ===== 分数等级颜色（使用测评记录中的 scoring_ranges）=====
type ScoringRange = { min: number; max: number; label: string }

function getScoreColor(
  score: number | null | undefined,
  scoringRanges: ScoringRange[] | null | undefined,
) {
  if (score === null || score === undefined) return "text-muted-foreground"
  if (scoringRanges?.length) {
    for (const r of scoringRanges) {
      if (score >= r.min && score <= r.max) {
        if (r.label.includes("正常") || r.label.includes("良好"))
          return "text-emerald-600"
        if (r.label.includes("关注")) return "text-amber-600"
        if (r.label.includes("严重") || r.label.includes("危险"))
          return "text-rose-600"
      }
    }
  }
  // 兜底：百分比判断
  const pct = score
  if (pct >= 80) return "text-emerald-600"
  if (pct >= 60) return "text-amber-600"
  return "text-rose-600"
}

function getLevelBadge(
  score: number | null | undefined,
  scoringRanges: ScoringRange[] | null | undefined,
) {
  if (score === null || score === undefined)
    return "bg-muted text-muted-foreground"
  if (scoringRanges?.length) {
    for (const r of scoringRanges) {
      if (score >= r.min && score <= r.max) {
        if (r.label.includes("正常") || r.label.includes("良好"))
          return "bg-emerald-50 text-emerald-700 border-emerald-200"
        if (r.label.includes("关注"))
          return "bg-amber-50 text-amber-700 border-amber-200"
        if (r.label.includes("严重") || r.label.includes("危险"))
          return "bg-rose-50 text-rose-700 border-rose-200"
      }
    }
  }
  const pct = score
  if (pct >= 80) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (pct >= 60) return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-rose-50 text-rose-700 border-rose-200"
}

function getLevelLabel(
  score: number | null | undefined,
  scoringRanges: ScoringRange[] | null | undefined,
) {
  if (score === null || score === undefined) return "待评估"
  if (scoringRanges?.length) {
    for (const r of scoringRanges) {
      if (score >= r.min && score <= r.max) {
        return r.label
      }
    }
  }
  const pct = score
  if (pct >= 80) return "良好"
  if (pct >= 60) return "中等"
  return "需关注"
}

// ===== 简易折线图组件 =====
function MiniChart({ data }: { data: { day: string; score: number }[] }) {
  const maxScore = 100
  const chartW = 400
  const chartH = 200
  const padX = 40
  const padY = 32
  const innerW = chartW - padX * 2
  const innerH = chartH - padY * 2

  // 健康区间（百分比）：60-80 为正常区间
  const healthyMinY = padY + innerH - (80 / maxScore) * innerH
  const healthyMaxY = padY + innerH - (60 / maxScore) * innerH

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * innerW,
    y: padY + innerH - (d.score / maxScore) * innerH,
    label: d.day,
    value: d.score,
  }))

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ")
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padY + innerH} L ${points[0].x} ${padY + innerH} Z`

  return (
    <svg
      viewBox={`0 0 ${chartW} ${chartH}`}
      className="w-full"
      style={{ maxHeight: 200 }}
      role="img"
      aria-label="心理健康评分趋势图"
    >
      <title>心理健康评分趋势图</title>
      {/* 健康区间背景色（60-80 分） */}
      <rect
        x={padX}
        y={healthyMinY}
        width={innerW}
        height={healthyMaxY - healthyMinY}
        fill="#22c55e"
        opacity={0.06}
        rx={4}
      />

      {/* 网格线 */}
      {[0, 25, 50, 75, 100].map((v) => {
        const y = padY + innerH - (v / maxScore) * innerH
        return (
          <g key={v}>
            <line
              x1={padX}
              y1={y}
              x2={chartW - padX}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.08}
            />
            <text
              x={padX - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={10}
            >
              {v}
            </text>
          </g>
        )
      })}

      {/* 面积填充 */}
      <path d={areaPath} fill="url(#trendGradient)" opacity={0.25} />

      {/* 折线 */}
      <path
        d={linePath}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 数据点 + 百分比数值 */}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={4}
            fill="var(--color-primary)"
            stroke="white"
            strokeWidth={2}
          />
          {/* 百分比数值 */}
          <text
            x={p.x}
            y={p.y - 10}
            textAnchor="middle"
            className="fill-foreground"
            fontSize={11}
            fontWeight={600}
          >
            {p.value}%
          </text>
          {/* 日期标签 */}
          <text
            x={p.x}
            y={chartH - 4}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={11}
          >
            {p.label}
          </text>
        </g>
      ))}

      {/* 健康区间标注 */}
      <text
        x={chartW - padX + 4}
        y={healthyMinY + 10}
        className="fill-green-500"
        fontSize={9}
        opacity={0.7}
      >
        正常
      </text>
      <text
        x={chartW - padX + 4}
        y={padY + 12}
        className="fill-red-400"
        fontSize={9}
        opacity={0.7}
      >
        预警
      </text>

      {/* 渐变定义 */}
      <defs>
        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor="var(--color-primary)"
            stopOpacity={0.4}
          />
          <stop
            offset="100%"
            stopColor="var(--color-primary)"
            stopOpacity={0.02}
          />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ===== 智能导航辅助函数 =====
// 简化版：不再创建本地会话，直接导航到基础路由或最近的远程会话
async function smartNavigate(
  userId: string,
  contextKey: "ai-doctor" | "test",
  navigate: (opts: {
    to: string
    params?: Record<string, string>
    replace?: boolean
  }) => void,
) {
  const result = await getConversations(userId, {
    apiKeyName: contextKey,
  })

  if (result.data.length > 0) {
    // 有历史会话 → 跳转到最近的
    const mostRecent = result.data.reduce((latest, conv) =>
      conv.updated_at > latest.updated_at ? conv : latest,
    )
    const chatRoute =
      contextKey === "ai-doctor"
        ? "/user/ai-doctor/chat/$sessionId"
        : "/user/test/chat/$sessionId"
    navigate({ to: chatRoute, params: { sessionId: mostRecent.id } })
  } else {
    // 无历史会话 → 导航到基础路由（新对话模式）
    const modulePath =
      contextKey === "ai-doctor" ? "/user/ai-doctor" : "/user/test"
    navigate({ to: modulePath })
  }
}

// ===== 主页面 =====
function UserHome() {
  const { user } = useAuth()
  const userId = user?.id || "anonymous"
  const navigate = useNavigate()

  const [chatCount, setChatCount] = useState(0)
  const [testChatCount, setTestChatCount] = useState(0)
  const [testCount, setTestCount] = useState(0)
  const streakDays = user?.streak_days ?? 0
  const [countsLoading, setCountsLoading] = useState(true)
  const [navLoading, setNavLoading] = useState<string | null>(null)
  const quote = getQuoteOfTheDay()
  const today = new Date()
  const dateStr = today.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })

  // 获取最近测评记录
  const { data: testRecordsData } = useQuery({
    queryKey: ["test-records-home"],
    queryFn: () => TestRecordsService.getRecords1({ pageable: { page: 0, size: 100 } }),
  })
  const records = testRecordsData?.data ?? []

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [chat, testChat] = await Promise.all([
          getConversationCount(userId, "ai-doctor"),
          getConversationCount(userId, "test"),
        ])
        setChatCount(chat)
        setTestChatCount(testChat)
        // 测评次数用真实的测评记录数，而不是对话次数
        setTestCount(records.length)
      } catch {
        // ignore
      } finally {
        setCountsLoading(false)
      }
    }
    fetchCounts()
  }, [userId, records.length])

  // 从真实记录计算最近7天趋势（归一化为百分比，多次测评取日均值）
  const trendData = useMemo(() => {
    const now = new Date()
    const days: { day: string; score: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const dayLabel = d.toLocaleDateString("zh-CN", { weekday: "short" })
      const dayRecords = records.filter((r) => {
        if (!r.created_at || r.total_score === null) return false
        return r.created_at.slice(0, 10) === dateStr
      })
      // 多次测评取百分比均值
      const score =
        dayRecords.length > 0
          ? Math.round(
              dayRecords.reduce((sum, r) => {
                const max = r.total_max ?? 100
                return sum + (max > 0 ? (r.total_score! / max) * 100 : 0)
              }, 0) / dayRecords.length,
            )
          : 0
      days.push({ day: dayLabel, score })
    }
    return days
  }, [records])

  // 取最近3条记录展示
  const recentRecords = records.slice(0, 3)

  return (
    <div className="mx-auto max-w-6xl flex flex-col gap-6 p-6 md:p-8">
      {/* 顶部问候 */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="mr-2">👋</span>你好，欢迎回来
        </h1>
        <p className="text-muted-foreground text-sm">{dateStr}</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-4 py-5">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <MessageSquare className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs font-medium">
                对话次数
              </p>
              <div className="mt-0.5 flex items-center gap-3 text-sm">
                <span className="truncate">
                  医生：
                  <span className="font-bold text-foreground">
                    {countsLoading ? "--" : chatCount}
                  </span>
                </span>
                <span className="text-border">|</span>
                <span className="truncate">
                  测评：
                  <span className="font-bold text-foreground">
                    {countsLoading ? "--" : testChatCount}
                  </span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-4 py-5">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <ClipboardCheck className="size-5" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">
                测评次数
              </p>
              <p className="text-2xl font-bold">
                {countsLoading ? "--" : testCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-4 py-5">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Calendar className="size-5" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">
                连续使用天数
              </p>
              <p className="text-2xl font-bold">{streakDays}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 心理健康趋势 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" />
            <CardTitle className="text-base">心理测评健康指数趋势</CardTitle>
          </div>
          <CardDescription>
            近 7 天心理测评健康指数（归一化百分比）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MiniChart data={trendData} />
        </CardContent>
      </Card>

      {/* 快捷入口 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Stethoscope className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">智能心理医生</CardTitle>
                <CardDescription>
                  AI 倾听你的心声，提供专业心理支持
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardFooter>
            <Button
              className="w-full gap-2"
              variant="outline"
              disabled={navLoading === "ai-doctor"}
              onClick={async () => {
                if (navLoading) return
                setNavLoading("ai-doctor")
                try {
                  await smartNavigate(userId, "ai-doctor", navigate)
                } catch {
                  navigate({ to: "/user/ai-doctor" })
                } finally {
                  setNavLoading(null)
                }
              }}
            >
              {navLoading === "ai-doctor" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  开始对话
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </CardFooter>
          <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-primary/5" />
        </Card>

        <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <Brain className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">心理测评</CardTitle>
                <CardDescription>
                  专业量表评估，了解你的心理健康状态
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardFooter>
            <Button
              className="w-full gap-2"
              variant="outline"
              disabled={navLoading === "test"}
              onClick={async () => {
                if (navLoading) return
                setNavLoading("test")
                try {
                  await smartNavigate(userId, "test", navigate)
                } catch {
                  navigate({ to: "/user/test" })
                } finally {
                  setNavLoading(null)
                }
              }}
            >
              {navLoading === "test" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  开始测评
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </CardFooter>
          <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-violet-50" />
        </Card>
      </div>

      {/* 最近测评记录 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-primary" />
            <CardTitle className="text-base">最近测评记录</CardTitle>
          </div>
          <CardDescription>查看您近期的测评结果</CardDescription>
        </CardHeader>
        <CardContent>
          {recentRecords.length > 0 ? (
            <div className="flex flex-col divide-y">
              {recentRecords.map((record) => {
                const recordDate = record.created_at
                  ? new Date(record.created_at).toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "未知日期"
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-medium">{record.test_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {recordDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {record.total_score !== null &&
                        record.total_score !== undefined &&
                        (() => {
                          const max = record.total_max ?? 100
                          const scoringRanges =
                            (record.scoring_ranges as
                              | ScoringRange[]
                              | null
                              | undefined) ?? null
                          return (
                            <span
                              className={`text-lg font-bold ${getScoreColor(record.total_score, scoringRanges)}`}
                            >
                              {record.total_score}
                              <span className="text-xs font-normal text-muted-foreground">
                                /{max}
                              </span>
                            </span>
                          )
                        })()}
                      {record.total_score !== null &&
                        record.total_score !== undefined &&
                        (() => {
                          const scoringRanges =
                            (record.scoring_ranges as
                              | ScoringRange[]
                              | null
                              | undefined) ?? null
                          return (
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getLevelBadge(record.total_score, scoringRanges)}`}
                            >
                              {getLevelLabel(record.total_score, scoringRanges)}
                            </span>
                          )
                        })()}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ClipboardCheck className="mb-2 size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">暂无测评记录</p>
              <p className="text-xs text-muted-foreground/70">
                完成一次测评后将在这里显示
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 每日一言 */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex items-start gap-3 py-4">
          <span className="text-xl">💡</span>
          <div>
            <p className="text-sm font-medium text-foreground/80">每日一言</p>
            <p className="mt-1 text-base leading-relaxed text-foreground/60 italic">
              「{quote}」
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
