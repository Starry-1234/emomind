/**
 * 时间格式化工具函数
 * 统一处理 UTC 时间 → 本地时间（北京时间）的转换与显示
 */

/**
 * 将 UTC ISO 字符串转换为本地时间的中文格式显示
 * 适用于分析报告的 created_at 字段（格式：2026-04-27T23:52:11.123456+00:00）
 */
export function formatUTCTime(utcString: string): string {
  if (!utcString) return ""
  // 解析 UTC 时间字符串，toLocaleString 会自动转换为运行环境的本地时区
  const date = new Date(utcString)
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

/**
 * 将 UTC ISO 字符串转换为简短的中文格式（不含秒，适合列表显示）
 */
export function formatUTCTimeShort(utcString: string): string {
  if (!utcString) return ""
  const date = new Date(utcString)
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}
