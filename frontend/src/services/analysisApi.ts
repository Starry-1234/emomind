/**
 * 分析报告 API 服务
 * 调用后端 /api/v1/analysis 接口
 */

const API_BASE = "/api/v1/analysis"

export interface FileAnalysisReport {
  id: string
  file_name: string
  file_type: string
  file_size: number | null
  analysis_result: string
  conversation_id: string | null
  created_at: string
  owner_id: string
}

export interface FileAnalysisReportsPublic {
  data: FileAnalysisReport[]
  count: number
}

/**
 * 获取当前用户的分析报告列表
 */
export async function getAnalysisReports(
  token: string,
  skip = 0,
  limit = 100,
): Promise<FileAnalysisReportsPublic> {
  const res = await fetch(`${API_BASE}/reports?skip=${skip}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) throw new Error("获取分析报告失败")
  return res.json()
}

/**
 * 获取单个分析报告详情
 */
export async function getAnalysisReport(
  reportId: string,
  token: string,
): Promise<FileAnalysisReport> {
  const res = await fetch(`${API_BASE}/reports/${reportId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) throw new Error("获取分析报告详情失败")
  return res.json()
}

/**
 * 创建分析报告（分析完成后调用）
 */
export async function createAnalysisReport(
  data: {
    file_name: string
    file_type: string
    file_size: number | null
    analysis_result: string
    conversation_id?: string | null
  },
  token: string,
): Promise<FileAnalysisReport> {
  console.log("createAnalysisReport 被调用，URL:", `${API_BASE}/reports`)
  console.log("请求数据:", data)
  console.log("token:", token ? "存在" : "不存在")
  
  const res = await fetch(`${API_BASE}/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  
  console.log("响应状态码:", res.status)
  
  if (!res.ok) {
    const errorText = await res.text()
    console.error("请求失败，响应内容:", errorText)
    throw new Error(`保存分析报告失败 (${res.status}): ${errorText}`)
  }
  
  const result = await res.json()
  console.log("请求成功，返回数据:", result)
  return result
}

/**
 * 删除分析报告
 */
export async function deleteAnalysisReport(
  reportId: string,
  token: string,
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/reports/${reportId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) throw new Error("删除分析报告失败")
  return res.json()
}
