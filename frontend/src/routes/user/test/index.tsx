import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { sendChatStream } from "@/services/langgraphApi"
import { ProgressBar } from "./components/ProgressBar"
import { TestIntake } from "./components/TestIntake"
import { TestQuestion, type TestQuestionItem } from "./components/TestQuestion"
import { TestReport, type TestReportData } from "./components/TestReport"
import {
  clearState,
  loadState,
  type PsychTestAnswer,
  saveState,
} from "./lib/localStorage"

export const Route = createFileRoute("/user/test/")({
  component: PsychTestPage,
})

type Phase = "intake" | "asking" | "complete" | "error"

interface IntakePayload {
  text: string
}

interface AnswerPayload {
  score: number
  text: string
}

/**
 * M3 psych_test front-end. Three phases:
 *
 *   1. intake — free-text description, send `intent=start_test`
 *   2. asking — Q&A loop; each round sends `intent=answer` with the
 *               user's score + elaboration; backend streams the next
 *               question's text via SSE tokens
 *   3. complete — backend's `message_end` carries the full report JSON
 *                 in `state.report`; we read it via a final getState call
 *
 * Known gap: M3 streaming.py emits node_start only for tracked nodes
 * (the M1+M2 set), so the frontend does NOT receive an explicit "next
 * question" frame. The frontend optimistically tracks `current` locally
 * to stay in sync with the backend's state.current. The backend's
 * generated next-question text arrives as the assistant_reply
 * accumulated from `token` events, but `generate_next_question` has no
 * LLM call of its own — so the streamed tokens for the Q&A loop are
 * the previous assistant_reply (intake confirmation / LLM answer text)
 * until M4/M5 wire a `state` SSE event. Documented in task-7-report.
 */
function PsychTestPage() {
  const [phase, setPhase] = useState<Phase>("intake")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intakeReply, setIntakeReply] = useState("")
  const [threadId, setThreadId] = useState<string>("")
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(0)
  const [pending, setPending] = useState<TestQuestionItem | null>(null)
  const [answers, setAnswers] = useState<PsychTestAnswer[]>([])
  const [report, setReport] = useState<TestReportData | null>(null)
  const [recordId, setRecordId] = useState<string>("")
  const [emotionTags] = useState<string[]>([])

  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Restore from localStorage on mount (best-effort; backend state may
  // have been lost across process restarts).
  useEffect(() => {
    const restored = loadState()
    if (!restored) return
    if (
      restored.questions.length > 0 &&
      restored.current < restored.questions.length
    ) {
      setThreadId(restored.thread_id)
      setCurrent(restored.current)
      setAnswers(restored.answers)
      setPhase("asking")
    }
  }, [])

  // Persist on each Q&A round.
  useEffect(() => {
    if (phase !== "asking") return
    if (!threadId) return
    const fakeQuestions = answers.map((a) => a.question_id)
    saveState({
      thread_id: threadId,
      current,
      questions: fakeQuestions,
      answers,
      started_at: new Date().toISOString(),
    })
  }, [phase, threadId, current, answers])

  const handleStart = async ({ text }: IntakePayload) => {
    setLoading(true)
    setError(null)
    let accumulated = ""
    let capturedThread = ""
    try {
      await sendChatStream(
        "psych-test",
        { messages: [{ role: "user", content: text }] },
        {
          onRunStart: (tid) => {
            if (tid) capturedThread = tid
          },
          onToken: (delta) => {
            accumulated += delta
          },
          onMessageEnd: (tid, _runId, fullContent) => {
            capturedThread = tid || capturedThread
            setIntakeReply(fullContent || accumulated)
            if (capturedThread) setThreadId(capturedThread)
            setPhase("asking")
            setCurrent(0)
            // total will be inferred from server state; M3 streaming
            // doesn't expose the count, so set a sensible default and
            // rely on local counters + localStorage.
            setTotal((prev) => (prev > 0 ? prev : 30))
          },
          onError: (_code, message) => {
            setError(message)
            setPhase("error")
          },
        },
        { threadId: undefined },
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setPhase("error")
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  const handleAnswer = async ({ score, text }: AnswerPayload) => {
    if (!pending) return
    setLoading(true)
    setError(null)
    let accumulated = ""
    let capturedThread = threadId
    let nextReply = ""
    try {
      // Send the previous question as assistant + this answer as user.
      // Backend will score the answer, increment current, then stream
      // either the next question's text (via assistant_reply LLM call
      // in analyze_answer) or the report (when current == total).
      await sendChatStream(
        "psych-test",
        {
          messages: [
            { role: "assistant", content: pending.text },
            {
              role: "user",
              content: `${text || "(无补充)"} (score=${score})`,
            },
          ],
        },
        {
          onRunStart: (tid) => {
            if (tid) capturedThread = tid
          },
          onToken: (delta) => {
            accumulated += delta
          },
          onMessageEnd: (tid, _runId, fullContent) => {
            capturedThread = tid || capturedThread
            if (tid) setThreadId(tid)
            nextReply = fullContent || accumulated

            const newAnswer: PsychTestAnswer = {
              question_id: pending.id,
              score,
              answer_text: text,
            }
            const updatedAnswers = [...answers, newAnswer]
            setAnswers(updatedAnswers)

            const nextCurrent = current + 1
            setCurrent(nextCurrent)

            // Heuristic: if the backend reply looks like a report JSON
            // (contains "total_score" or "interpretation"), transition
            // to complete. Otherwise treat as the next question text.
            const looksLikeReport =
              nextReply.includes("total_score") ||
              nextReply.includes("dimension_breakdown") ||
              nextReply.includes("interpretation")

            if (looksLikeReport) {
              const parsed = tryParseReport(nextReply)
              if (parsed) {
                setReport(parsed)
                setRecordId(`stub-${capturedThread.slice(0, 8) || "record"}`)
                setPhase("complete")
                clearState()
              } else {
                // Couldn't parse; fall through and treat as next question
                setPending({
                  id: `q${nextCurrent}`,
                  text: nextReply,
                })
              }
            } else {
              // Use the streamed reply as the next question's text.
              setPending({
                id: `q${nextCurrent}`,
                text: nextReply || "(等待下一题...)",
              })
            }
          },
          onError: (_code, message) => {
            setError(message)
            setPhase("error")
          },
        },
        { threadId: threadId || undefined },
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setPhase("error")
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  // ── Render by phase ─────────────────────────────────────────────

  if (phase === "intake") {
    return (
      <TestIntake
        onStart={(text) => {
          void handleStart({ text })
        }}
        loading={loading}
      />
    )
  }

  if (phase === "error") {
    return (
      <div
        data-testid="test-error"
        className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4"
      >
        <h2 className="font-serif-zh text-xl font-bold text-destructive">
          出错了
        </h2>
        <p className="text-sm text-foreground">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null)
            setPhase("intake")
            clearState()
          }}
          className="self-start rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          重新开始
        </button>
      </div>
    )
  }

  if (phase === "complete") {
    return (
      <TestReport
        report={
          report ?? {
            total_score: 0,
            total_max: 0,
            total_normalized: 0,
            dimension_breakdown: {},
            interpretation: "(未生成)",
            recommendations: "",
          }
        }
        test_record_id={recordId}
        emotion_tags={emotionTags}
      />
    )
  }

  // Phase: asking
  return (
    <div data-testid="test-asking" className="flex flex-col gap-2">
      <ProgressBar current={current} total={total} />
      {intakeReply && current === 0 && pending === null && (
        <div
          data-testid="intake-reply"
          className="mx-auto w-full max-w-2xl rounded-md border bg-muted/30 p-3 text-sm text-foreground"
        >
          {intakeReply}
        </div>
      )}
      {pending ? (
        <TestQuestion
          current={current}
          total={total}
          question={pending}
          onSubmit={(score, text) => {
            void handleAnswer({ score, text })
          }}
          loading={loading}
        />
      ) : (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            已收到您的描述，测评即将开始...
          </p>
          <button
            type="button"
            data-testid="start-qa-btn"
            disabled={loading}
            onClick={() => {
              // No pending question yet — the backend's first pending
              // question was set by start_test but its text didn't
              // stream to the client. Send a sentinel "answer" so the
              // graph's next round exposes the next question's text
              // via assistant_reply. Documented gap in task-7-report.
              void handleAnswer({ score: 0, text: "(开始)" })
            }}
            className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "加载中..." : "开始答题"}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Best-effort parse of the backend's streamed reply into a TestReportData.
 * The M3 streaming layer puts accumulated assistant_reply into
 * full_content; if the LLM streamed a JSON-ish blob we extract it.
 */
function tryParseReport(text: string): TestReportData | null {
  if (!text) return null
  // Direct JSON parse
  try {
    const obj = JSON.parse(text)
    if (typeof obj === "object" && obj && "total_score" in obj) {
      return obj as TestReportData
    }
  } catch {
    // fallthrough
  }
  // Try to find a JSON object within the text
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const obj = JSON.parse(match[0])
      if (typeof obj === "object" && obj && "total_score" in obj) {
        return obj as TestReportData
      }
    } catch {
      // fallthrough
    }
  }
  return null
}
