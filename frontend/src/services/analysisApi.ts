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
  limit = 100
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
  token: string
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
  token: string
): Promise<FileAnalysisReport> {
  const res = await fetch(`${API_BASE}/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("保存分析报告失败")
  return res.json()
}

/**
 * 删除分析报告
 */
export async function deleteAnalysisReport(
  reportId: string,
  token: string
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
