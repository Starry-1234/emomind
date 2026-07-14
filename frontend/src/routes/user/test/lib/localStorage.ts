/**
 * LocalStorage helpers for psych_test session state.
 *
 * The graph uses InMemorySaver (process-local) keyed on thread_id, so a
 * full-page reload keeps the server-side state. localStorage is only
 * used client-side as a UI hint to resume progress (the question text
 * the user was last looking at, the answers already given).
 *
 * The frontend owns persistence: anything the user submits is mirrored
 * here so a refresh restores the visual state.
 */

export interface PsychTestAnswer {
  question_id: string
  score: number
  answer_text: string
}

export interface PsychTestState {
  thread_id: string
  current: number
  questions: string[]
  answers: PsychTestAnswer[]
  started_at: string
  emotion_tags?: string[]
}

const KEY = "psych_test_state"

export function saveState(state: PsychTestState): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // localStorage may be full, disabled, or in private mode; ignore.
  }
}

export function loadState(): PsychTestState | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PsychTestState
    if (!parsed || typeof parsed !== "object") return null
    if (typeof parsed.thread_id !== "string") return null
    return parsed
  } catch {
    return null
  }
}

export function clearState(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
