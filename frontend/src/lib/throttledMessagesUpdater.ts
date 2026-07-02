import type React from "react"

/**
 * 创建一个对 React setMessages 的尾沿节流（trailing-edge throttle）封装。
 *
 * 关键设计点：
 * - `schedule(value)` 在 delay 窗口内重复调用时，只保留最后一次 value。
 * - `flush()` 立即应用 pendingValue（用于流结束 / error 收尾）。
 * - `cancel()` 取消挂起的定时器并丢弃 pendingValue（用于 stop、卸载、会话切换、并发新流）。
 *   暴露 cancel 是 stop / 卸载路径修复与上一版的核心区别：让外部终止路径
 *   能安全地丢弃尚未应用的 setMessages 写入。
 */
export interface ThrottledMessagesUpdater<T> {
  schedule: (value: T[]) => void
  flush: () => void
  cancel: () => void
}

export function createThrottledMessagesUpdater<T>(
  setMessages: React.Dispatch<React.SetStateAction<T[]>>,
  delay = 50,
): ThrottledMessagesUpdater<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingValue: T[] | null = null

  const applyNow = () => {
    if (pendingValue !== null) {
      setMessages(pendingValue)
      pendingValue = null
    }
  }

  const schedule = (value: T[]) => {
    pendingValue = value
    if (timer !== null) return
    timer = setTimeout(() => {
      timer = null
      applyNow()
    }, delay)
  }

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    applyNow()
  }

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    pendingValue = null
  }

  return { schedule, flush, cancel }
}
