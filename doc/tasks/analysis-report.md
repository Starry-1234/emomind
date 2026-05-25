# 文件分析报告模块任务文档

## 任务概述
- **功能描述**: 用户上传文件的分析报告创建、查询、删除
- **涉及模块**: controller, service, repository, entity, dto
- **依赖任务**: auth, database, user-management

## 需求要点
- 用户可创建新的分析报告（文件名、类型、大小、分析结果）
- 用户可查看自己的分析报告列表（分页）
- 用户可查看单个分析报告详情
- 用户可删除自己的分析报告
- 所有操作需认证，自动关联当前用户

## 设计要点
- **关键类**: AnalysisController, AnalysisService, FileAnalysisReportRepository, FileAnalysisReport entity
- **数据流**: Client → AnalysisController → AnalysisService → FileAnalysisReportRepository → PostgreSQL
- **边界条件**: 分页参数校验、资源归属校验（只能操作自己的报告）

## 实现步骤
1. [x] 编写 FileAnalysisReport entity
2. [x] 编写 FileAnalysisReportRepository
3. [x] 编写 AnalysisService
4. [x] 编写 AnalysisController
5. [x] 实现 GET /analysis/reports（列表查询）
6. [x] 实现 POST /analysis/reports（创建报告）
7. [x] 实现 GET /analysis/reports/{id}（详情查询）
8. [x] 实现 DELETE /analysis/reports/{id}（删除报告）
9. [x] 编写 DTO（request/response）
10. [x] 编写 MapStruct 映射
11. [x] 单元测试

## 验收标准
- [x] 用户可创建分析报告
- [x] 创建时自动关联当前用户
- [x] 用户可查看自己的报告列表（分页正常）
- [x] 用户可查看单个报告详情
- [x] 用户可删除自己的报告
- [x] 无法查看/删除他人的报告（返回 401）
- [x] 删除用户时级联删除其报告（DB ON DELETE CASCADE）

## 相关文档
- 需求文档：doc/requirements.md #3.3
- 详细设计：doc/detailed-design.md #3.3, #4.1, #4.4, #4.5
