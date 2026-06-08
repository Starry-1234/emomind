import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"
import { SealIcon } from "@/components/Common/SealIcon"
import { useEffect, useMemo, useState } from "react"
import { TestRecordsService } from "@/client"
import { Button } from "@/components/ui/button"
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

// ===== 分数等级颜色（东方色系）=====
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
          return "text-[#5a7a6a]"
        if (r.label.includes("关注")) return "text-[#8b7355]"
        if (r.label.includes("严重") || r.label.includes("危险"))
          return "text-[#c45a43]"
      }
    }
  }
  const pct = score
  if (pct >= 80) return "text-[#5a7a6a]"
  if (pct >= 60) return "text-[#8b7355]"
  return "text-[#c45a43]"
}

function getLevelBadge(
  score: number | null | undefined,
  scoringRanges: ScoringRange[] | null | undefined,
) {
  if (score === null || score === undefined)
    return "bg-secondary text-muted-foreground"
  if (scoringRanges?.length) {
    for (const r of scoringRanges) {
      if (score >= r.min && score <= r.max) {
        if (r.label.includes("正常") || r.label.includes("良好"))
          return "bg-[#5a7a6a]/10 text-[#5a7a6a] border-[#5a7a6a]/20"
        if (r.label.includes("关注"))
          return "bg-[#8b7355]/10 text-[#8b7355] border-[#8b7355]/20"
        if (r.label.includes("严重") || r.label.includes("危险"))
          return "bg-[#c45a43]/10 text-[#c45a43] border-[#c45a43]/20"
      }
    }
  }
  const pct = score
  if (pct >= 80) return "bg-[#5a7a6a]/10 text-[#5a7a6a] border-[#5a7a6a]/20"
  if (pct >= 60) return "bg-[#8b7355]/10 text-[#8b7355] border-[#8b7355]/20"
  return "bg-[#c45a43]/10 text-[#c45a43] border-[#c45a43]/20"
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

// ===== 水墨风格趋势图 =====
function InkTrendChart({ data }: { data: { day: string; score: number }[] }) {
  const maxScore = 100
  const chartW = 640
  const chartH = 220
  const padX = 48
  const padY = 40
  const innerW = chartW - padX * 2
  const innerH = chartH - padY * 2

  const validData = data.filter((d) => d.score > 0)
  if (validData.length < 2) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
        近七日暂无测评数据
      </div>
    )
  }

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * innerW,
    y: padY + innerH - (d.score / maxScore) * innerH,
    label: d.day,
    value: d.score,
  }))

  // 平滑曲线（catmull-rom spline 转 bezier）
  const linePath = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`
    const prev = arr[i - 1]
    const cp1x = prev.x + (p.x - prev.x) / 3
    const cp1y = prev.y
    const cp2x = p.x - (p.x - prev.x) / 3
    const cp2y = p.y
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`
  }, "")

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padY + innerH} L ${points[0].x} ${padY + innerH} Z`

  return (
    <svg
      viewBox={`0 0 ${chartW} ${chartH}`}
      className="w-full"
      style={{ maxHeight: 220 }}
      role="img"
      aria-label="心理健康评分趋势图"
    >
      <title>心理健康评分趋势图</title>

      {/* 水墨晕染背景区域 */}
      <defs>
        <linearGradient id="inkArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d4a3e" stopOpacity="0.25" />
          <stop offset="60%" stopColor="#2d4a3e" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#2d4a3e" stopOpacity="0" />
        </linearGradient>
        <filter id="inkBlur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" />
        </filter>
      </defs>

      {/* 健康区间（60-80） */}
      <rect
        x={padX}
        y={padY + innerH - (80 / maxScore) * innerH}
        width={innerW}
        height={(20 / maxScore) * innerH}
        fill="#5a7a6a"
        opacity={0.05}
        rx={2}
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
              strokeOpacity={0.06}
              strokeDasharray={v === 60 || v === 80 ? "4 4" : "0"}
            />
            <text
              x={padX - 10}
              y={y + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={10}
              fontFamily="var(--font-sans)"
            >
              {v}
            </text>
          </g>
        )
      })}

      {/* 水墨面积填充 */}
      <path
        d={areaPath}
        fill="url(#inkArea)"
        className="ink-fill"
      />

      {/* 水墨主线条 */}
      <path
        d={linePath}
        fill="none"
        stroke="#2d4a3e"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ink-stroke"
        style={{ filter: "url(#inkBlur)" }}
      />
      <path
        d={linePath}
        fill="none"
        stroke="#2d4a3e"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ink-stroke"
      />

      {/* 数据点 */}
      {points.map((p, i) => (
        <g key={i} className="animate-fade-in-up" style={{ animationDelay: `${0.8 + i * 0.1}s` }}>
          <circle
            cx={p.x}
            cy={p.y}
            r={5}
            fill="var(--card)"
            stroke="#2d4a3e"
            strokeWidth={2}
          />
          <circle
            cx={p.x}
            cy={p.y}
            r={10}
            fill="#2d4a3e"
            opacity={0}
            className="transition-opacity duration-300 hover:opacity-10"
            style={{ cursor: "pointer" }}
          >
            <title>{`${p.label}: ${p.value}%`}</title>
          </circle>
          <text
            x={p.x}
            y={p.y - 12}
            textAnchor="middle"
            className="fill-foreground"
            fontSize={11}
            fontWeight={600}
            fontFamily="var(--font-sans)"
          >
            {p.value}%
          </text>
          <text
            x={p.x}
            y={chartH - 8}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={11}
            fontFamily="var(--font-sans)"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ===== 智能导航辅助函数 =====
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
    const mostRecent = result.data.reduce((latest, conv) =>
      conv.updated_at > latest.updated_at ? conv : latest,
    )
    const chatRoute =
      contextKey === "ai-doctor"
        ? "/user/ai-doctor/chat/$sessionId"
        : "/user/test/chat/$sessionId"
    navigate({ to: chatRoute, params: { sessionId: mostRecent.id } })
  } else {
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
        setTestCount(records.length)
      } catch {
        // ignore
      } finally {
        setCountsLoading(false)
      }
    }
    fetchCounts()
  }, [userId, records.length])

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

  const recentRecords = records.slice(0, 3)

  return (
    <div className="ink-wash-bg mx-auto max-w-6xl flex flex-col gap-8 p-6 md:p-10">
      {/* 顶部问候 */}
      <header className="animate-fade-in-up relative">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {dateStr}
          </p>
          <h1 className="font-serif-zh text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            情之所至，今日安否
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {quote}
          </p>
        </div>
        <div className="absolute -right-4 -top-4 hidden size-24 opacity-[0.03] md:block">
          <svg viewBox="0 0 100 100" fill="currentColor">
            <circle cx="50" cy="50" r="45" />
          </svg>
        </div>
      </header>

      {/* 统计卡片 */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: () => <SealIcon char="话" size="lg" />,
            label: "对话",
            value: countsLoading
              ? "--"
              : `${chatCount} / ${testChatCount}`,
            sub: "医生 · 测评",
            delay: "delay-100",
            tone: "primary",
          },
          {
            icon: () => <SealIcon char="录" size="lg" />,
            label: "测评次数",
            value: countsLoading ? "--" : testCount,
            sub: "已完成量表",
            delay: "delay-200",
            tone: "accent",
          },
          {
            icon: () => <SealIcon char="日" size="lg" />,
            label: "连续使用",
            value: streakDays,
            sub: "天",
            delay: "delay-300",
            tone: "muted",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`animate-fade-in-up memo-card rounded-lg p-5 ${stat.delay}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-1 font-serif-zh text-2xl font-semibold text-foreground">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {stat.sub}
                </p>
              </div>
              <div
                className={`flex size-10 items-center justify-center rounded-md ${
                  stat.tone === "primary"
                    ? "bg-[#2d4a3e]/8 text-[#2d4a3e]"
                    : stat.tone === "accent"
                    ? "bg-[#c45a43]/8 text-[#c45a43]"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                <stat.icon />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* 心理健康趋势 */}
      <section className="animate-fade-in-up delay-400 memo-card rounded-lg">
        <div className="border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-2">
            <SealIcon char="势" />
            <h2 className="font-serif-zh text-base font-semibold">
              七日心象
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            近七日心理测评健康指数走势
          </p>
        </div>
        <div className="px-4 py-5 md:px-6">
          <InkTrendChart data={trendData} />
        </div>
      </section>

      {/* 快捷入口 */}
      <section className="animate-fade-in-up delay-500 grid gap-4 md:grid-cols-2">
        {[
          {
            key: "ai-doctor",
            icon: () => <SealIcon char="医" size="lg" />,
            title: "智能心理医生",
            desc: "AI 倾听你的心声，提供专业心理支持",
            cta: "开始对话",
          },
          {
            key: "test",
            icon: () => <SealIcon char="录" size="lg" />,
            title: "心理测评",
            desc: "专业量表评估，了解你的心理健康状态",
            cta: "开始测评",
          },
        ].map((item) => (
          <div
            key={item.key}
            className="memo-card group relative overflow-hidden rounded-lg p-5"
          >
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[#2d4a3e]/8 text-[#2d4a3e] transition-colors group-hover:bg-[#2d4a3e] group-hover:text-[#f7f4ef]">
                <item.icon />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif-zh text-base font-semibold">
                  {item.title}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                className="brush-btn gap-1 border-border/60 bg-background/60 text-xs"
                disabled={navLoading === item.key}
                onClick={async () => {
                  if (navLoading) return
                  setNavLoading(item.key)
                  try {
                    await smartNavigate(
                      userId,
                      item.key as "ai-doctor" | "test",
                      navigate,
                    )
                  } catch {
                    navigate({
                      to:
                        item.key === "ai-doctor"
                          ? "/user/ai-doctor"
                          : "/user/test",
                    })
                  } finally {
                    setNavLoading(null)
                  }
                }}
              >
                {navLoading === item.key ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    加载中
                  </span>
                ) : (
                  <>
                    {item.cta}
                    <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </div>
            {/* 装饰水墨圆 */}
            <div className="pointer-events-none absolute -bottom-8 -right-8 size-32 rounded-full bg-[#2d4a3e]/[0.02] transition-transform duration-700 group-hover:scale-110" />
          </div>
        ))}
      </section>

      {/* 最近测评记录 + 每日一言 */}
      <section className="animate-fade-in-up delay-600 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* 最近记录 */}
        <div className="memo-card rounded-lg">
          <div className="border-b border-border/60 px-6 py-4">
            <div className="flex items-center gap-2">
              <SealIcon char="录" />
              <h2 className="font-serif-zh text-base font-semibold">
                最近测评
              </h2>
            </div>
          </div>
          <div className="px-6 py-2">
            {recentRecords.length > 0 ? (
              <div className="flex flex-col">
                {recentRecords.map((record, idx) => {
                  const recordDate = record.created_at
                    ? new Date(record.created_at).toLocaleDateString("zh-CN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "未知日期"
                  const scoringRanges =
                    (record.scoring_ranges as ScoringRange[] | null | undefined) ??
                    null
                  return (
                    <div
                      key={record.id}
                      className="group flex items-center justify-between border-b border-border/40 py-4 last:border-b-0 transition-colors hover:bg-secondary/30 -mx-6 px-6"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-muted-foreground">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-sm font-medium text-foreground">
                            {record.test_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {recordDate}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {record.total_score !== null &&
                          record.total_score !== undefined && (
                            <span
                              className={`font-serif-zh text-lg font-semibold ${getScoreColor(
                                record.total_score,
                                scoringRanges,
                              )}`}
                            >
                              {record.total_score}
                              <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                /{record.total_max ?? 100}
                              </span>
                            </span>
                          )}
                        {record.total_score !== null &&
                          record.total_score !== undefined && (
                            <span
                              className={`rounded-sm border px-2 py-0.5 text-[10px] font-medium ${getLevelBadge(
                                record.total_score,
                                scoringRanges,
                              )}`}
                            >
                              {getLevelLabel(record.total_score, scoringRanges)}
                            </span>
                          )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="font-serif-zh text-sm text-muted-foreground">暂无测评记录</p>
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  完成一次测评后将在这里显示
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 每日一言 - 便签风格 */}
        <div className="animate-paper-float relative">
          <div className="memo-card h-full rounded-lg bg-[#faf8f3] rotate-[0.3deg]">
            <div className="h-2 w-full bg-[#c45a43]/20 rounded-t-lg" />
            <div className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="seal text-[10px] px-1 py-0.5 border-[#c45a43]/60 text-[#c45a43]">
                  日签
                </span>
                <span className="text-xs text-muted-foreground">
                  今日寄语
                </span>
              </div>
              <p className="font-serif-zh text-base leading-relaxed text-foreground/90">
                「{quote}」
              </p>
              <div className="mt-4 flex justify-end">
                <span className="font-serif-zh text-xs text-muted-foreground/70">
                  — 致今日的你
                </span>
              </div>
            </div>
          </div>
          {/* 阴影层 */}
          <div
            className="absolute inset-0 -z-10 rounded-lg bg-[#2d4a3e]/[0.03]"
            style={{ transform: "rotate(-0.8deg) translate(4px, 4px)" }}
          />
        </div>
      </section>

      {/* 底部留白，让水墨背景透气 */}
      <div className="h-4" />
    </div>
  )
}
