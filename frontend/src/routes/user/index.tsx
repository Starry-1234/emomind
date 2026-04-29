import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  MessageSquare,
  ClipboardCheck,
  Calendar,
  Brain,
  Stethoscope,
  TrendingUp,
  ChevronRight,
} from "lucide-react"
import { useEffect, useState } from "react"
import { getConversationCount, DIFY_AI_DOCTOR_API_KEY, DIFY_TEST_API_KEY } from "@/services/difyApi"

export const Route = createFileRoute("/user/")({
  component: UserHome,
  head: () => ({
    meta: [
      {
        title: "用户中心",
      },
    ],
  }),
})

// ===== 动态统计数据 =====
const USER = "default-user" // 与 ai-doctor.tsx / test.tsx 保持一致

const MOCK_TREND = [
  { day: "周一", score: 62 },
  { day: "周二", score: 58 },
  { day: "周三", score: 65 },
  { day: "周四", score: 52 },
  { day: "周五", score: 70 },
  { day: "周六", score: 68 },
  { day: "周日", score: 75 },
]

const MOCK_HISTORY = [
  { id: 1, name: "焦虑自评量表", date: "2026-04-25", score: 72, total: 100, level: "需要关注" },
  { id: 2, name: "睡眠质量评估", date: "2026-04-23", score: 45, total: 100, level: "正常范围" },
  { id: 3, name: "心理健康综合自评", date: "2026-04-20", score: 68, total: 100, level: "需要关注" },
]

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
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  )
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length]
}

// ===== 简易折线图组件 =====
function MiniChart({ data }: { data: { day: string; score: number }[] }) {
  const maxScore = 100
  const chartW = 400
  const chartH = 160
  const padX = 40
  const padY = 24
  const innerW = chartW - padX * 2
  const innerH = chartH - padY * 2

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * innerW,
    y: padY + innerH - (d.score / maxScore) * innerH,
    label: d.day,
    value: d.score,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padY + innerH} L ${points[0].x} ${padY + innerH} Z`

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ maxHeight: 180 }}>
      {/* 网格线 */}
      {[0, 25, 50, 75, 100].map((v) => {
        const y = padY + innerH - (v / maxScore) * innerH
        return (
          <g key={v}>
            <line x1={padX} y1={y} x2={chartW - padX} y2={y} stroke="currentColor" strokeOpacity={0.08} />
            <text x={padX - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
              {v}
            </text>
          </g>
        )
      })}

      {/* 面积填充 */}
      <path d={areaPath} fill="url(#trendGradient)" opacity={0.3} />

      {/* 折线 */}
      <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {/* 数据点 */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="var(--color-primary)" stroke="white" strokeWidth={2} />
          <text x={p.x} y={chartH - 4} textAnchor="middle" className="fill-muted-foreground" fontSize={11}>
            {p.label}
          </text>
        </g>
      ))}

      {/* 渐变定义 */}
      <defs>
        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ===== 分数等级颜色 =====
function getScoreColor(score: number, total: number) {
  const pct = (score / total) * 100
  if (pct <= 33) return "text-emerald-600"
  if (pct <= 66) return "text-amber-600"
  return "text-rose-600"
}

function getLevelBadge(level: string) {
  if (level === "正常范围") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (level === "需要关注") return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-rose-50 text-rose-700 border-rose-200"
}

// ===== 主页面 =====
function UserHome() {
  const [chatCount, setChatCount] = useState(0)
  const [testCount, setTestCount] = useState(0)
  const [streakDays, setStreakDays] = useState(0)
  const [loading, setLoading] = useState(true)
  const quote = getQuoteOfTheDay()
  const today = new Date()
  const dateStr = today.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [chat, test] = await Promise.all([
          getConversationCount(USER, DIFY_AI_DOCTOR_API_KEY),
          getConversationCount(USER, DIFY_TEST_API_KEY),
        ])
        setChatCount(chat)
        setTestCount(test)
      } catch (err) {
        console.error("获取会话统计失败:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchCounts()
  }, [])

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
            <div>
              <p className="text-muted-foreground text-xs font-medium">对话次数</p>
              <p className="text-2xl font-bold">{loading ? "--" : chatCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-4 py-5">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <ClipboardCheck className="size-5" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">测评次数</p>
              <p className="text-2xl font-bold">{loading ? "--" : testCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-4 py-5">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Calendar className="size-5" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">连续使用天数</p>
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
            <CardTitle className="text-base">心理健康趋势</CardTitle>
          </div>
          <CardDescription>近 7 天综合评分变化</CardDescription>
        </CardHeader>
        <CardContent>
          <MiniChart data={MOCK_TREND} />
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
                <CardDescription>AI 倾听你的心声，提供专业心理支持</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardFooter>
            <Link to="/user/ai-doctor" className="w-full">
              <Button className="w-full gap-2" variant="outline">
                开始对话
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </CardFooter>
          {/* 装饰背景 */}
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
                <CardDescription>专业量表评估，了解你的心理健康状态</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardFooter>
            <Link to="/user/test" className="w-full">
              <Button className="w-full gap-2" variant="outline">
                开始测评
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
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
          {MOCK_HISTORY.length > 0 ? (
            <div className="flex flex-col divide-y">
              {MOCK_HISTORY.map((record) => (
                <div key={record.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium">{record.name}</p>
                    <p className="text-xs text-muted-foreground">{record.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${getScoreColor(record.score, record.total)}`}>
                      {record.score}
                      <span className="text-xs font-normal text-muted-foreground">/{record.total}</span>
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getLevelBadge(record.level)}`}>
                      {record.level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ClipboardCheck className="mb-2 size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">暂无测评记录</p>
              <p className="text-xs text-muted-foreground/70">完成一次测评后将在这里显示</p>
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
