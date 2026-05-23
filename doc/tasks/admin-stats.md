# 管理员统计模块任务文档

## 任务概述
- **功能描述**: 管理员仪表盘统计数据查询
- **涉及模块**: controller, service, repository
- **依赖任务**: auth, database, user-management

## 需求要点
- 获取平台统计数据：用户总数、测评记录总数、分析报告总数
- 获取今日新增数据：今日新增用户数、今日新增测评记录数、今日新增分析报告数
- 仅超级用户可访问

## 设计要点
- **关键类**: AdminController, AdminStatsService
- **数据流**: Client → AdminController → AdminStatsService → Repository → PostgreSQL
- **边界条件**: 权限校验（仅超级用户）、今日日期计算（Asia/Shanghai 时区）

## 实现步骤
1. [ ] 编写 AdminStatsService（统计查询）
2. [ ] 编写 AdminController（REST API）
3. [ ] 实现 GET /admin/stats（统计数据）
4. [ ] 配置管理员权限（@PreAuthorize）
5. [ ] 单元测试

## 验收标准
- [ ] 统计数据准确（用户总数、测评总数、报告总数）
- [ ] 今日新增数据准确
- [ ] 仅超级用户可访问
- [ ] 普通用户访问返回 403

## 相关文档
- 需求文档：doc/requirements.md #3.6
- 详细设计：doc/detailed-design.md #3.6, #4.4, #4.5