# 性能优化任务文档

## 任务概述
- **功能描述**: 确保系统满足性能需求指标
- **涉及模块**: 全局（数据库连接池、API 响应、并发处理）
- **依赖任务**: database.md, deployment.md

## 需求要点
- API 响应时间 P95 < 200ms（不含 Dify 代理请求）
- 并发用户数 >= 100
- 数据库连接池最小 5、最大 20
- 页面加载时间 < 3 秒

## 设计要点
- **关键配置**: HikariCP 连接池、Spring Boot 异步处理、Nginx 静态文件缓存
- **数据流**: 请求 → 连接池 → 查询优化 → 响应
- **边界条件**: Dify 代理请求为外部依赖，不计入性能指标

## 实现步骤
1. [ ] 配置 HikariCP 连接池（minimum-idle: 5, maximum-pool-size: 20）
2. [ ] 配置 API 响应时间监控（Micrometer + Prometheus 或 Actuator）
3. [ ] 为慢查询添加数据库索引（已包含在 database.md 中）
4. [ ] 配置 Nginx 静态文件缓存策略
5. [ ] 使用 JMeter 或 k6 进行并发压力测试（100 并发用户）
6. [ ] 记录并优化 P95 响应时间

## 验收标准
- [ ] P95 API 响应时间 < 200ms（本地测试，不含 Dify）
- [ ] 100 并发用户下系统无错误
- [ ] 数据库连接池配置正确（5~20）
- [ ] 前端页面加载时间 < 3 秒（Lighthouse 评分）
- [ ] 压力测试报告存档

## 相关文档
- 需求文档：doc/requirements.md #4.1
- 详细设计：doc/detailed-design.md #2.3（索引设计）、#7.1（连接池配置）
- 任务文档：doc/tasks/database.md
