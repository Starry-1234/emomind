import { cn } from "@/lib/utils"

interface SealIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  char: string
  size?: "sm" | "md" | "lg"
}

/**
 * 印章文字图标
 *
 * 用单个汉字做成小印章，替代通用的 Lucide 图标。
 * 与项目整体的东方疗愈/信笺风格保持一致。
 */
export function SealIcon({
  char,
  size = "md",
  className,
  ...props
}: SealIconProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded border border-primary/70 bg-primary/[0.04] font-serif-zh font-bold text-primary shrink-0 select-none",
        size === "sm" && "h-3.5 w-3.5 text-[9px]",
        size === "md" && "h-4 w-4 text-[10px]",
        size === "lg" && "h-5 w-5 text-sm",
        className,
      )}
      {...props}
    >
      {char}
    </span>
  )
}
