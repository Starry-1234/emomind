import { Link } from "@tanstack/react-router"

import { useTheme } from "@/components/Common/theme-provider"
import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
  animated?: boolean
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
  animated = true,
}: LogoProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const textColor = isDark ? "text-[#e8e2d9]" : "text-[#2d4a3e]"
  const sealBorder = isDark ? "border-[#d97b65]" : "border-[#c45a43]"
  const sealBg = isDark ? "bg-[#d97b65]/10" : "bg-[#c45a43]/8"
  const sealText = isDark ? "text-[#d97b65]" : "text-[#c45a43]"

  const sealMark = (
    <span
      className={cn(
        "seal text-[10px] leading-none px-1 py-0.5",
        sealBorder,
        sealBg,
        sealText,
        animated && "animate-seal-pulse"
      )}
    >
      心
    </span>
  )

  const brandText = (
    <span
      className={cn(
        "font-serif-zh tracking-wide",
        textColor,
        variant === "icon" ? "text-2xl" : "text-3xl"
      )}
    >
      情之所至
    </span>
  )

  const content = (
    <div
      className={cn(
        "flex items-center gap-2 group/logo",
        variant === "responsive" && "ml-8 group-data-[collapsible=icon]:ml-0",
        className
      )}
    >
      {sealMark}
      <div className="relative">
        {brandText}
        {animated && (
          <span
            className={cn(
              "absolute -bottom-0.5 left-0 h-[2px] w-0 rounded-full transition-all duration-700 ease-out group-hover/logo:w-full",
              isDark ? "bg-[#d97b65]/60" : "bg-[#c45a43]/60"
            )}
          />
        )}
      </div>
    </div>
  )

  if (!asLink) {
    return content
  }

  return (
    <Link to="/" className="hover:opacity-90 transition-opacity">
      {content}
    </Link>
  )
}
