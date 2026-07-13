interface ProgressBarProps {
  current: number
  total: number
}

/**
 * Phase 2 progress indicator. Shows textual "n / total" plus a visual
 * filled bar. `total` is whatever the M3 graph selected at RAG time
 * (could be 30 in production, smaller in dev / tests).
 */
export function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0

  return (
    <div
      data-testid="progress-bar"
      className="mx-auto flex w-full max-w-2xl flex-col gap-1.5 px-4 pt-4"
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>答题进度</span>
        <span
          data-testid="progress-text"
          className="font-medium text-foreground"
        >
          {current} / {total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          data-testid="progress-fill"
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
