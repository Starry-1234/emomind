import { useTheme } from "@/components/theme-provider"

/**
 * 自定义Hook用于检测当前主题状态
 * 提供便捷的主题检测功能，让组件能够根据当前主题调整样式
 */
export const useCurrentTheme = () => {
  const { resolvedTheme } = useTheme()

  const isWarmTheme = resolvedTheme === 'warm'
  const isDarkTheme = resolvedTheme === 'dark'
  const isLightTheme = resolvedTheme === 'light'
  const isNoneTheme = resolvedTheme === 'none'
  const isColorfulTheme = resolvedTheme === 'colorful'

  return {
    isWarmTheme,
    isDarkTheme,
    isLightTheme,
    isNoneTheme,
    isColorfulTheme,
    resolvedTheme,
    // 便捷的主题类名生成器
    getThemeClassNames: (baseClass: string, options?: {
      warm?: string
      dark?: string
      light?: string
      none?: string
      colorful?: string
    }) => {
      const classNames = [baseClass]

      if (isWarmTheme && options?.warm) {
        classNames.push(options.warm)
      } else if (isDarkTheme && options?.dark) {
        classNames.push(options.dark)
      } else if (isLightTheme && options?.light) {
        classNames.push(options.light)
      } else if (isNoneTheme && options?.none) {
        classNames.push(options.none)
      } else if (isColorfulTheme && options?.colorful) {
        classNames.push(options.colorful)
      }

      return classNames.join(' ')
    },
    // 判断是否为高对比度主题（深色或温馨）
    isHighContrast: isDarkTheme || isWarmTheme,
    // 判断是否为暖色调主题
    isWarmTone: isWarmTheme,
    // 判断是否为冷色调主题
    isCoolTone: isDarkTheme || isLightTheme,
    // 判断是否使用了自定义主题
    isCustomTheme: isWarmTheme || isColorfulTheme,
    // 判断是否为动画主题
    isAnimatedTheme: isColorfulTheme
  }
}