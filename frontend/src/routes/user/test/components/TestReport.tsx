import { Card } from "@/components/ui/card"

export interface DimensionBreakdownEntry {
  dimension_cn: string
  score: number
  max: number
  normalized: number
  level: string
}

export interface TestReportData {
  total_score: number
  total_max: number
  total_normalized: number
  dimension_breakdown: Record<string, DimensionBreakdownEntry>
  interpretation: string
  recommendations: string
}

interface TestReportProps {
  report: TestReportData
  test_record_id: string
  emotion_tags: string[]
}

/**
 * Phase 3: read-only report view. Renders total score, per-dimension
 * breakdown, LLM interpretation, LLM recommendations, and a stub badge
 * on the test_record_id (M3 persistence is a STUB; M4 wires real
 * TestRecord writes).
 */
export function TestReport({
  report,
  test_record_id,
  emotion_tags,
}: TestReportProps) {
  return (
    <div
      data-testid="report"
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4"
    >
      <div className="space-y-1">
        <h2 className="font-serif-zh text-xl font-bold text-foreground">
          心理评估报告
        </h2>
        <p className="text-xs text-muted-foreground">
          记录 ID:{" "}
          <span data-testid="test-record-id" className="font-mono">
            {test_record_id || "(未生成)"}
          </span>
          <span
            data-testid="stub-badge"
            className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          >
            STUB (M3)
          </span>
        </p>
      </div>

      <Card className="space-y-2 p-5">
        <h3 className="text-sm font-semibold text-foreground">总分</h3>
        <p
          data-testid="total-score"
          className="font-serif-zh text-3xl font-bold text-primary"
        >
          {report.total_score} / {report.total_max}{" "}
          <span className="text-base font-medium text-muted-foreground">
            ({report.total_normalized}%)
          </span>
        </p>
      </Card>

      {emotion_tags.length > 0 && (
        <Card className="space-y-2 p-5">
          <h3 className="text-sm font-semibold text-foreground">情感标签</h3>
          <p data-testid="emotion-tags" className="text-sm text-foreground">
            {emotion_tags.join("、")}
          </p>
        </Card>
      )}

      <Card className="space-y-3 p-5">
        <h3 className="text-sm font-semibold text-foreground">各维度</h3>
        <ul data-testid="dimension-breakdown" className="space-y-2">
          {Object.entries(report.dimension_breakdown).map(([dim, info]) => (
            <li key={dim} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">
                  {info.dimension_cn}（{dim}）
                </span>
                <span className="text-xs text-muted-foreground">
                  {info.score} / {info.max}（{info.normalized}%，{info.level}）
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all duration-500"
                  style={{ width: `${Math.min(100, info.normalized)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2 p-5">
        <h3 className="text-sm font-semibold text-foreground">解读</h3>
        <p
          data-testid="interpretation"
          className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
        >
          {report.interpretation}
        </p>
      </Card>

      <Card className="space-y-2 p-5">
        <h3 className="text-sm font-semibold text-foreground">建议</h3>
        <p
          data-testid="recommendations"
          className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
        >
          {report.recommendations}
        </p>
      </Card>
    </div>
  )
}
