import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"

interface StreamingMessageProps {
  content: string
  isStreaming: boolean
  className?: string
}

/**
 * 逐字动画渲染流式消息
 *
 * 将后端传来的增量文本平滑地逐字显示，模拟 Deepseek 式的打字机效果。
 * 即使后端每隔几百毫秒才推送一次增量，前端也会以 60fps 的速率逐字渲染。
 */
export function StreamingMessage({
  content,
  isStreaming,
  className,
}: StreamingMessageProps) {
  const [displayText, setDisplayText] = useState(content)
  const targetRef = useRef(content)
  const frameRef = useRef<number>(0)

  // 持续同步目标文本
  useEffect(() => {
    targetRef.current = content
    if (!isStreaming) {
      setDisplayText(content)
    }
  }, [content, isStreaming])

  // 逐字动画循环
  useEffect(() => {
    if (!isStreaming) return

    const animate = () => {
      setDisplayText((prev) => {
        const target = targetRef.current
        const remaining = target.length - prev.length
        if (remaining <= 0) return prev

        // 动态加速：剩余字符越多，每帧显示的字符越多
        // 保证在 20-30 帧内追上目标，同时最小粒度为 1 字符
        const charsToAdd = Math.max(
          1,
          Math.min(remaining, Math.ceil(remaining / 25)),
        )
        return target.slice(0, prev.length + charsToAdd)
      })
      frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [isStreaming])

  return (
    <div className={className}>
      <ReactMarkdown>{displayText || ""}</ReactMarkdown>
      {isStreaming && displayText.length < targetRef.current.length && (
        <span className="ml-0.5 inline-block animate-pulse text-current opacity-70">
          |
        </span>
      )}
    </div>
  )
}
