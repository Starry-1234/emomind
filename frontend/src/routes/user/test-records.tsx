import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Loader2,
  MoreVertical,
} from "lucide-react"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import { TestRecordsService } from "@/client"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const Route = createFileRoute("/user/test-records")({
  component: TestRecords,
  head: () => ({
    meta: [{ title: "测评记录" }],
  }),
})

function TestRecords() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null)
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [qaExpanded, setQaExpanded] = useState(false)
  const limit = 20

  const { data, isLoading, error } = useQuery({
    queryKey: ["test-records", page],
    queryFn: async () => {
      const response = await TestRecordsService.readTestRecords({
        skip: page * limit,
        limit: limit,
      })
      return response
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => TestRecordsService.deleteTestRecord({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-records"] })
      setDeleteRecordId(null)
    },
  })

  const records = data?.data || []
  const totalCount = data?.count || 0
  const totalPages = Math.ceil(totalCount / limit)

  const selectedRecordData = records.find((r) => r.id === selectedRecord)

  const formatDate = (dateStr: string | null | undefined) => {
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

  const getTimeGroup = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "未知"
    const date = new Date(dateStr)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const recordDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    )
    const diffDays = Math.floor(
      (today.getTime() - recordDay.getTime()) / (1000 * 60 * 60 * 24),
    )
    if (diffDays === 0) return "今天"
    if (diffDays === 1) return "昨天"
    if (diffDays <= 7) return "7天内"
    if (diffDays <= 30) return "30天内"
    return "30天外"
  }

  const groupedRecords: Record<string, typeof records> = {}
  for (const record of records) {
    const group = getTimeGroup(record.created_at)
    if (!groupedRecords[group]) groupedRecords[group] = []
    groupedRecords[group].push(record)
  }

  const groupOrder = ["今天", "昨天", "7天内", "30天内", "30天外"]

  const getScoreColor = (
    score: number | null | undefined,
    scoringRanges:
      | { min: number; max: number; label: string }[]
      | null
      | undefined,
  ) => {
    if (score === null || score === undefined)
      return "bg-gray-100 text-gray-600"
    if (scoringRanges?.length) {
      for (const r of scoringRanges) {
        if (score >= r.min && score <= r.max) {
          if (r.label.includes("正常") || r.label.includes("良好"))
            return "bg-green-100 text-green-700"
          if (r.label.includes("关注")) return "bg-yellow-100 text-yellow-700"
          if (r.label.includes("寻求帮助") || r.label.includes("严重"))
            return "bg-red-100 text-red-700"
        }
      }
    }
    // fallback 硬编码（老数据）
    if (score >= 80) return "bg-green-100 text-green-700"
    if (score >= 60) return "bg-yellow-100 text-yellow-700"
    return "bg-red-100 text-red-700"
  }

  const getScoreLabel = (
    score: number | null | undefined,
    scoringRanges:
      | { min: number; max: number; label: string }[]
      | null
      | undefined,
  ) => {
    if (score === null || score === undefined) return "待评估"
    if (scoringRanges?.length) {
      for (const r of scoringRanges) {
        if (score >= r.min && score <= r.max) {
          return r.label
        }
      }
    }
    // fallback 硬编码（老数据）
    if (score >= 80) return "良好"
    if (score >= 60) return "中等"
    return "需关注"
  }

  const handleViewDetail = (id: string) => {
    setSelectedRecord(id)
    setShowDetail(true)
  }

  const handleDelete = () => {
    if (deleteRecordId) {
      deleteMutation.mutate(deleteRecordId)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-card">
      {/* 顶栏 */}
      <div className="flex items-center gap-3 border-b px-5 py-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-violet-100">
          <ClipboardList className="size-4 text-violet-600" />
        </div>
        <div>
          <h1 className="text-sm font-semibold">测评记录</h1>
          <p className="text-xs text-muted-foreground">查看历史测评结果</p>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            加载失败，请稍后重试
          </div>
        ) : records.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="size-16 rounded-full bg-violet-50 flex items-center justify-center">
              <FileText className="size-8 text-violet-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                暂无测评记录
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                完成心理测评后将自动生成记录
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {groupOrder.map((group) => {
              const groupData = groupedRecords[group]
              if (!groupData || groupData.length === 0) return null
              return (
                <div key={group}>
                  <h2 className="text-xs font-medium text-muted-foreground mb-2 px-1">
                    {group}
                  </h2>
                  <div className="space-y-2">
                    {groupData.map((record) => (
                      <Card
                        key={record.id}
                        className="p-4 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-sm truncate">
                                {record.test_name}
                              </h3>
                              <Badge
                                variant="outline"
                                className={`text-xs ${getScoreColor(
                                  record.total_score,
                                  record.scoring_ranges as
                                    | {
                                        min: number
                                        max: number
                                        label: string
                                      }[]
                                    | null
                                    | undefined,
                                )}`}
                              >
                                {getScoreLabel(
                                  record.total_score,
                                  record.scoring_ranges as
                                    | {
                                        min: number
                                        max: number
                                        label: string
                                      }[]
                                    | null
                                    | undefined,
                                )}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="size-3" />
                                {formatDate(record.created_at)}
                              </span>
                              {record.total_score !== null &&
                                record.total_score !== undefined && (
                                  <span className="font-medium text-foreground">
                                    得分：{record.total_score}
                                  </span>
                                )}
                            </div>
                            {record.result_description && (
                              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                                {record.result_description}
                              </p>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-8 p-0"
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleViewDetail(record.id)}
                              >
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteRecordId(record.id)}
                                className="text-destructive"
                              >
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 border-t p-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </Button>
          <span className="text-xs text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      {/* 详情 Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRecordData?.test_name}
              {selectedRecordData && (
                <Badge
                  variant="outline"
                  className={getScoreColor(
                    selectedRecordData.total_score,
                    selectedRecordData.scoring_ranges as
                      | { min: number; max: number; label: string }[]
                      | null
                      | undefined,
                  )}
                >
                  {getScoreLabel(
                    selectedRecordData.total_score,
                    selectedRecordData.scoring_ranges as
                      | { min: number; max: number; label: string }[]
                      | null
                      | undefined,
                  )}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedRecordData && (
            <div className="space-y-4">
              {/* 用户主题 */}
              {selectedRecordData.user_topic && (
                <div className="rounded-lg bg-violet-50 border border-violet-100 p-3">
                  <p className="text-xs font-medium text-violet-600 mb-1">
                    测评主题
                  </p>
                  <p className="text-sm text-foreground">
                    {selectedRecordData.user_topic}
                  </p>
                </div>
              )}

              {/* 时间和得分 */}
              <div className="text-xs text-muted-foreground">
                {formatDate(selectedRecordData.created_at)}
                {selectedRecordData.total_score !== null &&
                  selectedRecordData.total_score !== undefined && (
                    <span className="ml-4 font-medium text-foreground">
                      得分：{selectedRecordData.total_score}
                    </span>
                  )}
              </div>

              {/* Q&A 折叠区 */}
              {selectedRecordData.questions &&
                selectedRecordData.questions.length > 0 && (
                  <div className="border rounded-lg">
                    <button
                      type="button"
                      onClick={() => setQaExpanded((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                    >
                      <span>
                        题目与答案（共 {selectedRecordData.questions.length}{" "}
                        题）
                      </span>
                      {qaExpanded ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </button>
                    {qaExpanded && (
                      <div className="px-4 pb-4 space-y-3">
                        {(
                          selectedRecordData.questions as {
                            id: string
                            text: string
                            options: string[]
                            scores?: number[]
                          }[]
                        ).map((q, qIdx) => {
                          const userAnswer = (
                            selectedRecordData.answers as {
                              question_id: string
                              answer?: number
                              score?: number
                            }[]
                          )?.find((a) => a.question_id === q.id)
                          return (
                            <div key={q.id} className="text-sm">
                              <p className="font-medium mb-2">
                                <span className="text-violet-500 mr-1">
                                  {qIdx + 1}.
                                </span>
                                {q.text}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {q.options.map((opt, optIdx) => {
                                  const isSelected =
                                    userAnswer?.answer === optIdx + 1
                                  return (
                                    <span
                                      key={optIdx}
                                      className={`text-xs px-2 py-1 rounded-full border ${
                                        isSelected
                                          ? "bg-violet-100 border-violet-300 text-violet-700 font-medium"
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
              {selectedRecordData.result_description && (
                <div className="text-sm leading-relaxed">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    分析报告
                  </p>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>
                      {selectedRecordData.result_description}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认 AlertDialog */}
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
              onClick={handleDelete}
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
