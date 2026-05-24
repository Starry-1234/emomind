import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Play,
  RefreshCw,
} from "lucide-react"
import { useState } from "react"

interface MessageActionsProps {
  isPaused: boolean
  isStreaming: boolean
  versions?: string[]
  currentVersion?: number
  onContinue: () => void
  onCopy: () => void
  onRegenerate: () => void
  onSwitchVersion: (direction: -1 | 1) => void
  disabled?: boolean
}

export function MessageActions({
  isPaused,
  isStreaming,
  versions,
  currentVersion,
  onContinue,
  onCopy,
  onRegenerate,
  onSwitchVersion,
  disabled = false,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false)

  if (isStreaming) {
    return null
  }

  const hasVersions = versions && versions.length > 1
  const currentVer = currentVersion ?? 0
  const totalVersions = versions?.length ?? 1

  const handleCopyClick = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      {/* 复制按钮 */}
      <button
        type="button"
        onClick={handleCopyClick}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {copied ? (
          <>
            <Check className="size-3 text-green-500" />
            <span className="text-green-600">已复制</span>
          </>
        ) : (
          <>
            <Copy className="size-3" />
            <span>复制</span>
          </>
        )}
      </button>

      {/* 重新生成按钮 */}
      <button
        type="button"
        onClick={onRegenerate}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className="size-3" />
        <span>重新生成</span>
      </button>

      {/* 继续生成按钮（仅在暂停状态显示） */}
      {isPaused && (
        <button
          type="button"
          onClick={onContinue}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="size-3" />
          <span>继续生成</span>
        </button>
      )}

      {/* 版本切换器 */}
      {hasVersions && (
        <div className="ml-1 inline-flex items-center gap-0.5 rounded-md border bg-background px-1.5 py-0.5 text-xs">
          <button
            type="button"
            onClick={() => onSwitchVersion(-1)}
            disabled={disabled || currentVer <= 0}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="size-3" />
          </button>
          <span className="min-w-[3ch] text-center tabular-nums text-muted-foreground">
            {currentVer + 1}/{totalVersions}
          </span>
          <button
            type="button"
            onClick={() => onSwitchVersion(1)}
            disabled={disabled || currentVer >= totalVersions - 1}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="size-3" />
          </button>
        </div>
      )}
    </div>
  )
}
