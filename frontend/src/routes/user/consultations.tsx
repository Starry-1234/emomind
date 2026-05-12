import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Calendar, FileText, Loader2, MoreVertical } from "lucide-react"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import { AnalysisService } from "@/client"
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

export const Route = createFileRoute("/user/consultations")({
  component: Consultations,
  head: () => ({
    meta: [{ title: "咨询记录" }],
  }),
})

function Consultations() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const limit = 20

  const { data, isLoading, error } = useQuery({
    queryKey: ["analysis-reports", page],
    queryFn: async () => {
      const response = await AnalysisService.readAnalysisReports({
        skip: page * limit,
        limit: limit,
      })
      return response
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      AnalysisService.deleteAnalysisReport({ reportId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis-reports"] })
      setDeleteReportId(null)
    },
  })

  const reports = data?.data || []
  const totalCount = data?.count || 0
  const totalPages = Math.ceil(totalCount / limit)

  const selectedReportData = reports.find((r) => r.id === selectedReport)

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

  const groupedReports: Record<string, typeof reports> = {}
  for (const report of reports) {
    const group = getTimeGroup(report.created_at)
    if (!groupedReports[group]) groupedReports[group] = []
    groupedReports[group].push(report)
  }

  const groupOrder = ["今天", "昨天", "7天内", "30天内", "30天外"]

  const getFileTypeColor = (fileType: string | null | undefined) => {
    if (!fileType) return "bg-gray-100 text-gray-600"
    const lower = fileType.toLowerCase()
    if (lower.includes("pdf")) return "bg-red-100 text-red-700"
    if (lower.includes("doc") || lower.includes("word"))
      return "bg-blue-100 text-blue-700"
    if (lower.includes("image") || lower.includes("img"))
      return "bg-green-100 text-green-700"
    return "bg-violet-100 text-violet-700"
  }

  const handleViewDetail = (id: string) => {
    setSelectedReport(id)
    setShowDetail(true)
  }

  const handleDelete = () => {
    if (deleteReportId) {
      deleteMutation.mutate(deleteReportId)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-card">
      {/* 顶栏 */}
      <div className="flex items-center gap-3 border-b px-5 py-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100">
          <FileText className="size-4 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-sm font-semibold">咨询记录</h1>
          <p className="text-xs text-muted-foreground">查看文件分析历史</p>
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
        ) : reports.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="size-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <FileText className="size-8 text-emerald-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                暂无咨询记录
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                上传文件并完成分析后将自动生成记录
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {groupOrder.map((group) => {
              const groupData = groupedReports[group]
              if (!groupData || groupData.length === 0) return null
              return (
                <div key={group}>
                  <h2 className="text-xs font-medium text-muted-foreground mb-2 px-1">
                    {group}
                  </h2>
                  <div className="space-y-2">
                    {groupData.map((report) => (
                      <Card
                        key={report.id}
                        className="p-4 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-sm truncate">
                                {report.file_name}
                              </h3>
                              {report.file_type && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${getFileTypeColor(report.file_type)}`}
                                >
                                  {report.file_type.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="size-3" />
                                {formatDate(report.created_at)}
                              </span>
                              {report.conversation_id && (
                                <span className="text-muted-foreground/60">
                                  会话ID: {report.conversation_id.slice(0, 8)}
                                  ...
                                </span>
                              )}
                            </div>
                            {report.analysis_result && (
                              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                                {report.analysis_result
                                  .replace(/[#*`]/g, "")
                                  .slice(0, 100)}
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
                                onClick={() => handleViewDetail(report.id)}
                              >
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteReportId(report.id)}
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
              <FileText className="size-4 text-emerald-600" />
              {selectedReportData?.file_name}
            </DialogTitle>
          </DialogHeader>
          {selectedReportData && (
            <div className="space-y-4">
              {/* 文件信息 */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {formatDate(selectedReportData.created_at)}
                </span>
                {selectedReportData.file_type && (
                  <Badge
                    variant="outline"
                    className={getFileTypeColor(selectedReportData.file_type)}
                  >
                    {selectedReportData.file_type.toUpperCase()}
                  </Badge>
                )}
                {selectedReportData.file_size && (
                  <span>
                    {(selectedReportData.file_size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>

              {/* 分析结果 */}
              {selectedReportData.analysis_result && (
                <div className="text-sm leading-relaxed">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    分析报告
                  </p>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>
                      {selectedReportData.analysis_result}
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
        open={deleteReportId !== null}
        onOpenChange={(open) => !open && setDeleteReportId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将无法恢复，确定要删除这条咨询记录吗？
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
