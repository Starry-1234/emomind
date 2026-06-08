import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Inbox,
  Loader2,
  Search,
  User as UserIcon,
  X,
} from "lucide-react"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import { TestRecordsService, type UserResponse, UsersService } from "@/client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

export const Route = createFileRoute("/_admin-layout/admin-test-records")({
  component: TestRecordsAdmin,
  head: () => ({
    meta: [{ title: "测评记录管理" }],
  }),
})

/* ── 类型 ──────────────────────────────────────────── */

interface TestRecord {
  id: string
  test_name: string
  user_topic?: string
  total_score?: number
  total_max?: number
  created_at?: string
  result_description?: string
  scoring_ranges?: { min: number; max: number; label: string }[] | null
  questions?: {
    id: string
    text: string
    options: string[]
    scores?: number[]
  }[]
  answers?: { question_id: string; answer?: number; score?: number }[]
}

interface TestRecordsResponse {
  data: TestRecord[]
  count: number
}

/* ── 工具函数 ──────────────────────────────────────── */

function getInitial(name: string) {
  return name.charAt(0).toUpperCase()
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "未知日期"
  const date = new Date(dateStr)
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getScoreColor(
  score: number | null | undefined,
  scoringRanges:
    | { min: number; max: number; label: string }[]
    | null
    | undefined,
) {
  if (score === null || score === undefined) return "bg-gray-100 text-gray-600"
  if (scoringRanges?.length) {
    for (const r of scoringRanges) {
      if (score >= r.min && score <= r.max) {
        if (r.label.includes("正常") || r.label.includes("良好"))
          return "bg-[#5a7a6a]/10 text-[#5a7a6a] border-[#5a7a6a]/20"
        if (r.label.includes("关注")) return "bg-[#8b7355]/10 text-[#8b7355] border-[#8b7355]/20"
        if (r.label.includes("寻求帮助") || r.label.includes("严重"))
          return "bg-[#c45a43]/10 text-[#c45a43] border-[#c45a43]/20"
      }
    }
  }
  // 兼容老数据：无 scoring_ranges 时回退到硬编码
  if (score >= 80) return "bg-[#5a7a6a]/10 text-[#5a7a6a] border-[#5a7a6a]/20"
  if (score >= 60) return "bg-[#8b7355]/10 text-[#8b7355] border-[#8b7355]/20"
  return "bg-[#c45a43]/10 text-[#c45a43] border-[#c45a43]/20"
}

function getScoreLabel(
  score: number | null | undefined,
  scoringRanges:
    | { min: number; max: number; label: string }[]
    | null
    | undefined,
) {
  if (score === null || score === undefined) return "待评估"
  if (scoringRanges?.length) {
    for (const r of scoringRanges) {
      if (score >= r.min && score <= r.max) {
        return r.label
      }
    }
  }
  // 兼容老数据：无 scoring_ranges 时回退到硬编码
  if (score >= 80) return "良好"
  if (score >= 60) return "中等"
  return "需关注"
}

/* ── 详情栏 ─────────────────────────────────────────── */

function RecordDetailPanel({ record }: { record: TestRecord | null }) {
  const [qaExpanded, setQaExpanded] = useState(false)

  if (!record) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <span className="font-serif-zh text-sm">请选择一个测评记录查看详情</span>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {record.test_name}
            </span>
            <Badge
              variant="outline"
              className={getScoreColor(
                record.total_score,
                record.scoring_ranges,
              )}
            >
              {getScoreLabel(record.total_score, record.scoring_ranges)}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatDate(record.created_at)}
            {record.total_score !== null &&
              record.total_score !== undefined && (
                <span className="ml-3 font-medium text-foreground">
                  得分：{record.total_score}
                </span>
              )}
          </div>
        </div>
      </div>

      {/* 内容 */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-4">
          {/* 用户主题 */}
          {record.user_topic && (
            <div className="rounded-lg bg-secondary/50 border border-border p-3">
              <p className="text-xs font-medium text-primary mb-1">
                测评主题
              </p>
              <p className="text-sm text-foreground">{record.user_topic}</p>
            </div>
          )}

          {/* Q&A 折叠区 */}
          {record.questions && record.questions.length > 0 && (
            <div className="border rounded-lg">
              <button
                type="button"
                onClick={() => setQaExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <span>题目与答案（共 {record.questions.length} 题）</span>
                {qaExpanded ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>
              {qaExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  {record.questions.map((q, qIdx) => {
                    const userAnswer = record.answers?.find(
                      (a) => a.question_id === q.id,
                    )
                    return (
                      <div key={q.id} className="text-sm">
                        <p className="font-medium mb-2">
                          <span className="text-primary mr-1">
                            {qIdx + 1}.
                          </span>
                          {q.text}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = userAnswer?.answer === optIdx + 1
                            return (
                              <span
                                key={optIdx}
                                className={`text-xs px-2 py-1 rounded-full border ${
                                  isSelected
                                    ? "bg-primary/10 border-primary/20 text-primary font-medium"
                                    : "bg-muted/50 border-muted text-muted-foreground"
                                }`}
                              >
                                {opt}
                              </span>
                            )
                          })}
                        </div>
                        {userAnswer?.score !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">
                            得分：{userAnswer.score}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* 分析报告 */}
          {record.result_description && (
            <div className="text-sm leading-relaxed">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                分析报告
              </p>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{record.result_description}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

/* ── 主页面 ────────────────────────────────────────── */

function TestRecordsAdmin() {
  const queryClient = useQueryClient()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<TestRecord | null>(null)
  const [search, setSearch] = useState("")
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null)

  // 1) 用户列表
  const { data: usersRes, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => UsersService.getAllUsers({ pageable: { page: 0, size: 100 } }),
  })

  const allUsers = (usersRes?.data || []).filter(
    (u: UserResponse) => !u.is_superuser,
  )
  const filteredUsers = allUsers.filter((u: UserResponse) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    )
  })

  // 2) 选中用户的测评记录
  const { data: recordsRes, isLoading: recordsLoading } = useQuery({
    queryKey: ["admin-test-records", selectedUserId],
    queryFn: async () => {
      return TestRecordsService.getAllRecords({
        userId: selectedUserId || undefined,
        pageable: { page: 0, size: 100 },
      }) as Promise<TestRecordsResponse>
    },
    enabled: true,
  })

  const records = recordsRes?.data || []

  // 3) 删除记录
  const deleteMutation = useMutation({
    mutationFn: (id: string) => TestRecordsService.deleteAnyRecord({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-test-records", selectedUserId],
      })
      if (selectedRecord?.id === deleteRecordId) {
        setSelectedRecord(null)
      }
      setDeleteRecordId(null)
    },
  })

  const handleDeleteRecord = () => {
    if (deleteRecordId) {
      deleteMutation.mutate(deleteRecordId)
    }
  }

  return (
    <div className="flex h-full gap-4 p-4">
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden rounded-lg border bg-card">
        {/* ── 左栏：用户列表 ── */}
        <div className="flex w-56 flex-shrink-0 flex-col border-r">
          <div className="flex items-center justify-between border-b px-3 py-3">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">用户列表</span>
            </div>
            {filteredUsers.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filteredUsers.length}
              </Badge>
            )}
          </div>
          <div className="p-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-3.5 w-3.5" />
              <Input
                placeholder="搜索用户..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 px-1">
            {usersLoading ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                加载中...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-xs text-muted-foreground">
                <Inbox className="h-8 w-8" />
                <span>暂无用户</span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {filteredUsers.map((user: UserResponse) =>(
                  <button
                    type="button"
                    key={user.id}
                    onClick={() => {
                      setSelectedUserId(user.id!)
                      setSelectedRecord(null)
                    }}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors cursor-pointer ${
                      selectedUserId === user.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {getInitial(user.full_name || user.email || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">
                        {user.full_name || "未命名用户"}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ── 中栏：测评记录列表 ── */}
        <div className="flex w-72 flex-shrink-0 flex-col border-r">
          <div className="flex items-center justify-between border-b px-3 py-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">测评记录</span>
            </div>
            {records.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {records.length} 条
              </Badge>
            )}
          </div>

          {!selectedUserId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-xs text-muted-foreground">
              <UserIcon className="h-10 w-10" />
              <span>请先选择一个用户</span>
            </div>
          ) : recordsLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-xs text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <span>该用户暂无测评记录</span>
            </div>
          ) : (
            <ScrollArea className="flex-1 px-1 py-2">
              <div className="flex flex-col gap-2 px-2">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className={`group relative rounded-md border transition-colors ${
                      selectedRecord?.id === record.id
                        ? "bg-primary/5 border-primary/30"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={`查看测评记录: ${record.test_name}`}
                      className="w-full rounded-md p-3 text-left cursor-pointer"
                      onClick={() => setSelectedRecord(record)}
                    >
                      <div className="flex items-start justify-between gap-1.5 pr-5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium truncate">
                              {record.test_name}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getScoreColor(record.total_score, record.scoring_ranges)}`}
                            >
                              {getScoreLabel(
                                record.total_score,
                                record.scoring_ranges,
                              )}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              {formatDate(record.created_at)}
                            </span>
                            {record.total_score !== null &&
                              record.total_score !== undefined && (
                                <span className="font-medium text-foreground">
                                  {record.total_score}/{record.total_max ?? 100}
                                </span>
                              )}
                          </div>
                          {record.result_description && (
                            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                              {record.result_description
                                .replace(/[#*`]/g, "")
                                .slice(0, 80)}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                    {/* 删除按钮 */}
                    <button
                      type="button"
                      onClick={() => setDeleteRecordId(record.id)}
                      className="absolute right-2 top-2 size-6 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* ── 右栏：详情 ── */}
        <RecordDetailPanel record={selectedRecord} />
      </div>

      {/* 删除确认弹窗 */}
      <AlertDialog
        open={deleteRecordId !== null}
        onOpenChange={(open) => !open && setDeleteRecordId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将无法恢复，确定要删除这条测评记录吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRecord}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
