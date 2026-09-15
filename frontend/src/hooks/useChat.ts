import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from "react"
import { cancelChat } from "@/services/cancelApi"
import { sendChatStream } from "@/services/langgraphApi"
import type { Graph, LangGraphFile } from "@/services/langgraphTypes"

type Role = "user" | "assistant"
export interface Message {
  id: string
  role: Role
  content: string
  files?: LangGraphFile[]
  version: number
  isStreaming: boolean
  isPaused: boolean
  createdAt: number
}

export interface UseChatOptions {
  graph: Graph
  threadId: string | null
  userId: string
  conversationId?: string | null
  onConversationCreated?: (id: string) => void
  onMessageUpdate?: (msg: Message) => void
}

export interface UseChatReturn {
  messages: Message[]
  currentVersion: number
  isStreaming: boolean
  isPaused: boolean
  isCancelled: boolean
  error: Error | null
  send: (text: string, options?: { files?: File[] }) => Promise<void>
  stop: () => void
  pause: () => void
  resume: () => void
  regenerate: () => Promise<void>
  switchVersion: (v: number) => void
  // Direct setter used by side-channel flows (e.g. multimodal analysis modal)
  // that need to inject / replace messages without going through send().
  setMessages: Dispatch<SetStateAction<Message[]>>
}

// State machine
interface State {
  messages: Message[]
  currentVersion: number
  isStreaming: boolean
  isPaused: boolean
  isCancelled: boolean
  error: Error | null
}

type Action =
  | { type: "SEND"; msg: Message }
  | { type: "STREAM_START"; assistantId: string }
  | { type: "STREAM_TOKEN"; assistantId: string; delta: string }
  | {
      type: "STREAM_DONE"
      assistantId: string
      finalContent: string
      version: number
    }
  | { type: "STREAM_ERROR"; error: Error }
  | { type: "STOP" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "CANCELLED" }
  | { type: "REGENERATE"; newAssistantId: string; newVersion: number }
  | { type: "SWITCH_VERSION"; v: number }
  | { type: "SET_MESSAGES"; messages: Message[] }

const initial: State = {
  messages: [],
  currentVersion: 0,
  isStreaming: false,
  isPaused: false,
  isCancelled: false,
  error: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SEND":
      return {
        ...state,
        messages: [...state.messages, action.msg],
        error: null,
      }
    case "STREAM_START":
      return {
        ...state,
        isStreaming: true,
        messages: [
          ...state.messages,
          {
            id: action.assistantId,
            role: "assistant",
            content: "",
            version: state.currentVersion,
            isStreaming: true,
            isPaused: false,
            createdAt: Date.now(),
          },
        ],
      }
    case "STREAM_TOKEN":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.assistantId
            ? { ...m, content: m.content + action.delta }
            : m,
        ),
      }
    case "STREAM_DONE":
      return {
        ...state,
        isStreaming: false,
        currentVersion: action.version,
        messages: state.messages.map((m) =>
          m.id === action.assistantId
            ? { ...m, content: action.finalContent, isStreaming: false }
            : m,
        ),
      }
    case "STREAM_ERROR":
      return { ...state, isStreaming: false, error: action.error }
    case "STOP":
      return { ...state, isStreaming: false, isCancelled: true }
    case "PAUSE":
      return { ...state, isPaused: true }
    case "RESUME":
      return { ...state, isPaused: false }
    case "CANCELLED":
      return {
        ...state,
        isStreaming: false,
        isCancelled: true,
        error: new Error("Cancelled"),
      }
    case "REGENERATE":
      return {
        ...state,
        currentVersion: action.newVersion,
        messages: [
          ...state.messages,
          {
            id: action.newAssistantId,
            role: "assistant",
            content: "",
            version: action.newVersion,
            isStreaming: true,
            isPaused: false,
            createdAt: Date.now(),
          },
        ],
      }
    case "SWITCH_VERSION":
      return { ...state, currentVersion: action.v }
    case "SET_MESSAGES":
      return { ...state, messages: action.messages }
    default:
      return state
  }
}

function genId(): string {
  return crypto.randomUUID()
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const [state, dispatch] = useReducer(reducer, initial)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(
    async (text: string, _sendOptions?: { files?: File[] }) => {
      if (state.isStreaming) return
      const userMsg: Message = {
        id: genId(),
        role: "user",
        content: text,
        version: state.currentVersion,
        isStreaming: false,
        isPaused: false,
        createdAt: Date.now(),
      }
      dispatch({ type: "SEND", msg: userMsg })
      const assistantId = genId()
      dispatch({ type: "STREAM_START", assistantId })

      const ctrl = new AbortController()
      abortRef.current = ctrl
      const finalThreadId = options.threadId ?? genId()
      let finalContent = ""
      try {
        await sendChatStream(
          options.graph,
          { messages: [userMsg] },
          {
            onToken: (delta) => {
              finalContent += delta
              dispatch({ type: "STREAM_TOKEN", assistantId, delta })
            },
            onMessageEnd: (_threadId, _runId, fullContent) => {
              finalContent = fullContent
            },
            onError: (code, message) => {
              dispatch({
                type: "STREAM_ERROR",
                error: new Error(`${code}: ${message}`),
              })
            },
          },
          { signal: ctrl.signal, threadId: finalThreadId },
        )
        dispatch({
          type: "STREAM_DONE",
          assistantId,
          finalContent,
          version: state.currentVersion,
        })
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          dispatch({ type: "CANCELLED" })
          await cancelChat(finalThreadId) // best-effort Redis flag
        } else {
          dispatch({ type: "STREAM_ERROR", error: e as Error })
        }
      } finally {
        abortRef.current = null
      }
    },
    [options, state.isStreaming, state.currentVersion],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    dispatch({ type: "STOP" })
  }, [])

  const pause = useCallback(() => dispatch({ type: "PAUSE" }), [])
  const resume = useCallback(() => dispatch({ type: "RESUME" }), [])

  const regenerate = useCallback(async () => {
    if (state.isStreaming) return
    const lastUser = [...state.messages]
      .reverse()
      .find((m) => m.role === "user")
    if (!lastUser) return
    const newAssistantId = genId()
    const newVersion = state.currentVersion + 1
    dispatch({ type: "REGENERATE", newAssistantId, newVersion })
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const finalThreadId = options.threadId ?? genId()
    let finalContent = ""
    try {
      await sendChatStream(
        options.graph,
        { messages: [lastUser] },
        {
          onToken: (delta) => {
            finalContent += delta
            dispatch({
              type: "STREAM_TOKEN",
              assistantId: newAssistantId,
              delta,
            })
          },
          onMessageEnd: (_threadId, _runId, fullContent) => {
            finalContent = fullContent
          },
          onError: (code, message) => {
            dispatch({
              type: "STREAM_ERROR",
              error: new Error(`${code}: ${message}`),
            })
          },
        },
        { signal: ctrl.signal, threadId: finalThreadId },
      )
      dispatch({
        type: "STREAM_DONE",
        assistantId: newAssistantId,
        finalContent,
        version: newVersion,
      })
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        dispatch({ type: "CANCELLED" })
        await cancelChat(finalThreadId)
      } else {
        dispatch({ type: "STREAM_ERROR", error: e as Error })
      }
    } finally {
      abortRef.current = null
    }
  }, [options, state.isStreaming, state.currentVersion, state.messages])

  const switchVersion = useCallback(
    (v: number) => dispatch({ type: "SWITCH_VERSION", v }),
    [],
  )

  // setMessages dispatches SET_MESSAGES; compatible with React's standard
  // SetStateAction so callers can pass either an array or an updater fn.
  const setMessages = useCallback(
    (updater: SetStateAction<Message[]>) => {
      const next =
        typeof updater === "function"
          ? (updater as (prev: Message[]) => Message[])(state.messages)
          : updater
      dispatch({ type: "SET_MESSAGES", messages: next })
    },
    [state.messages],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  return {
    messages: state.messages,
    currentVersion: state.currentVersion,
    isStreaming: state.isStreaming,
    isPaused: state.isPaused,
    isCancelled: state.isCancelled,
    error: state.error,
    send,
    stop,
    pause,
    resume,
    regenerate,
    switchVersion,
    setMessages,
  }
}
