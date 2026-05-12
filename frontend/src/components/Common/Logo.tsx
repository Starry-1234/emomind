import { Link } from "@tanstack/react-router"

import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const isColorful = resolvedTheme === "colorful"
  const isWarm = resolvedTheme === "warm"

  const getTextStyle = () => {
    if (isColorful) {
      return "bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent"
    }
    if (isWarm) {
      return "bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent"
    }
    if (isDark) {
      return "text-white"
    }
    // 浅色主题下使用淡紫色
    return "text-purple-300"
  }

  const content =
    variant === "responsive" ? (
      <div className={cn("flex items-center ml-8", className)}>
        <span className={cn("font-black text-3xl group-data-[collapsible=icon]:hidden tracking-wide", getTextStyle())}>
          心驿智通
        </span>
      </div>
    ) : variant === "icon" ? (
      <span className={cn("font-black text-2xl tracking-wide ml-8", getTextStyle(), className)}>
        心驿智通
      </span>
    ) : (
      <div className={cn("flex items-center ml-8", className)}>
        <span className={cn("font-black text-4xl tracking-wide", getTextStyle())}>
          心驿智通
        </span>
      </div>
    )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
