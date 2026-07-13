import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface TestIntakeProps {
  onStart: (text: string) => void
  loading: boolean
}

/**
 * Phase 1: free-text intake. The user describes their state in a few
 * sentences; the M3 RAG pipeline uses this as the query embedding to
 * select the most relevant 30 questions for them.
 */
export function TestIntake({ onStart, loading }: TestIntakeProps) {
  const [text, setText] = useState("")

  const canSubmit = !loading && text.trim().length >= 5

  return (
    <div
      data-testid="test-intake"
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4"
    >
      <div className="space-y-1">
        <h2 className="font-serif-zh text-xl font-bold text-foreground">
          开始心理测评
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          请用一段话描述你最近的状态（任何想分享的内容）。我们会根据你的描述选择
          适合你的题目。
        </p>
      </div>

      <Card className="p-4">
        <textarea
          data-testid="intake-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如：我最近心情低落、失眠、对什么都提不起劲..."
          rows={5}
          disabled={loading}
          className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {text.trim().length}/500
          </span>
          <Button
            data-testid="intake-start-btn"
            onClick={() => onStart(text)}
            disabled={!canSubmit}
          >
            {loading ? "提交中..." : "开始测试"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
