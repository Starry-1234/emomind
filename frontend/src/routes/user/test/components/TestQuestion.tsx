import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export interface TestQuestionItem {
  id: string
  text: string
  dimension?: string
}

interface TestQuestionProps {
  current: number
  total: number
  question: TestQuestionItem
  onSubmit: (score: number, text: string) => void
  loading: boolean
}

const LIKERT_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "从不(0)" },
  { value: 1, label: "很少(1)" },
  { value: 2, label: "有时(2)" },
  { value: 3, label: "经常(3)" },
  { value: 4, label: "总是(4)" },
]

/**
 * Phase 2 (one question in the Q&A loop). Shows the question text, a
 * 5-option Likert scale, an optional free-text elaboration, and a
 * submit button that emits the next round.
 */
export function TestQuestion({
  current,
  total,
  question,
  onSubmit,
  loading,
}: TestQuestionProps) {
  const [score, setScore] = useState<number | null>(null)
  const [text, setText] = useState("")

  const canSubmit = !loading && score !== null

  return (
    <div
      data-testid="test-question"
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4"
    >
      <Card className="space-y-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-serif-zh text-lg font-semibold text-foreground">
            问题 {current + 1} / {total}
          </h3>
          {question.dimension && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {question.dimension}
            </span>
          )}
        </div>

        <p
          data-testid="question-text"
          className="text-base leading-relaxed text-foreground"
        >
          {question.text}
        </p>

        <fieldset
          className="grid grid-cols-5 gap-2 border-0 p-0 m-0"
          aria-label="Likert 评分"
        >
          {LIKERT_OPTIONS.map((opt) => {
            const selected = score === opt.value
            return (
              <label
                key={opt.value}
                data-testid={`likert-${opt.value}`}
                className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-xs font-medium transition-all duration-150 active:scale-95 ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/[0.02]"
                } ${loading ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name={`score-${question.id}`}
                  value={opt.value}
                  checked={selected}
                  onChange={() => setScore(opt.value)}
                  disabled={loading}
                  className="sr-only"
                />
                {opt.label}
              </label>
            )
          })}
        </fieldset>

        <textarea
          data-testid="question-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="（可选）补充说明..."
          rows={3}
          disabled={loading}
          className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
        />

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            data-testid="question-submit-btn"
            onClick={() => score !== null && onSubmit(score, text)}
            disabled={!canSubmit}
          >
            {loading ? "提交中..." : "下一题"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
