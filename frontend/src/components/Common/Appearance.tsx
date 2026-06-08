import { Circle, Heart, Monitor, Moon, Sun } from "lucide-react"

import { type Theme, useTheme } from "@/components/Common/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type LucideIcon = React.FC<React.SVGProps<SVGSVGElement>>

const ICON_MAP: Record<Theme, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
  warm: Heart,
  none: Circle,
}

const THEME_LABELS: Record<Theme, string> = {
  system: "跟随系统",
  light: "宣纸白",
  dark: "夜读墨",
  warm: "烛黄",
  none: "无",
}

export const SidebarAppearance = () => {
  const { isMobile } = useSidebar()
  const { setTheme, theme } = useTheme()
  const Icon = ICON_MAP[theme]

  return (
    <SidebarMenuItem>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip="外观" data-testid="theme-button">
            <Icon className="size-4 text-muted-foreground" />
            <span>外观</span>
            <span className="sr-only">切换主题</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={isMobile ? "top" : "right"}
          align="end"
          className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
        >
          <DropdownMenuItem onClick={() => setTheme("none")}>
            <Circle className="mr-2 h-4 w-4" />
            {THEME_LABELS.none}
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="light-mode"
            onClick={() => setTheme("light")}
          >
            <Sun className="mr-2 h-4 w-4" />
            {THEME_LABELS.light}
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="dark-mode"
            onClick={() => setTheme("dark")}
          >
            <Moon className="mr-2 h-4 w-4" />
            {THEME_LABELS.dark}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("warm")}>
            <Heart className="mr-2 h-4 w-4" />
            {THEME_LABELS.warm}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Monitor className="mr-2 h-4 w-4" />
            {THEME_LABELS.system}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

export const Appearance = () => {
  const { setTheme, theme, resolvedTheme } = useTheme()

  const themes: Theme[] = ["light", "dark", "warm"]

  return (
    <div className="flex items-center justify-center">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            data-testid="theme-button"
            variant="outline"
            size="icon"
            className="relative overflow-hidden border-border/60 bg-background/80 backdrop-blur-sm hover:bg-card"
          >
            <Sun
              className={cn(
                "h-[1.2rem] w-[1.2rem] transition-all duration-500",
                resolvedTheme === "dark"
                  ? "rotate-90 scale-0 opacity-0"
                  : "rotate-0 scale-100 opacity-100"
              )}
            />
            <Moon
              className={cn(
                "absolute h-[1.2rem] w-[1.2rem] transition-all duration-500",
                resolvedTheme === "dark"
                  ? "rotate-0 scale-100 opacity-100"
                  : "-rotate-90 scale-0 opacity-0"
              )}
            />
            <span className="sr-only">切换主题</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px]">
          {themes.map((t) => {
            const Icon = ICON_MAP[t]
            return (
              <DropdownMenuItem
                key={t}
                onClick={() => setTheme(t)}
                className={cn(
                  "cursor-pointer gap-2",
                  theme === t && "bg-secondary font-medium"
                )}
              >
                <Icon className="size-4" />
                {THEME_LABELS[t]}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
