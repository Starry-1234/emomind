# 测试策略任务文档

## 任务概述
- **功能描述**: 建立测试体系，确保代码覆盖率 >= 80%
- **涉及模块**: 全局（单元测试、集成测试、API 测试）
- **依赖任务**: 所有业务模块完成后执行

## 需求要点
- 单元测试覆盖 Service 层核心业务逻辑
- 集成测试覆盖 Repository 层数据库操作
- API 测试覆盖所有 Controller 端点
- 代码覆盖率 >= 80%（行覆盖率）
- 统一日志格式，支持结构化日志（与 MAINT-004 对齐）

## 设计要点
- **关键类**: 所有 *Test 类（JUnit 5 + Mockito + TestContainers）
- **数据流**: 测试数据 → H2/PostgreSQL 容器 → 断言验证
- **边界条件**: 认证失败、权限不足、数据不存在、并发冲突

## 实现步骤
1. [x] 配置测试环境（H2 内存数据库或 TestContainers PostgreSQL）
2. [x] 编写 UserService 单元测试（注册、登录、密码验证）
3. [x] 编写 AuthController API 测试（JWT 签发与验证）
4. [x] 编写 AnalysisService 单元测试（CRUD 业务逻辑）
5. [x] 编写 TestRecordService 单元测试（CRUD、管理员权限）
6. [x] 编写 AdminStatsService 单元测试（统计数据计算）
7. [ ] 编写 DifyProxy 集成测试（Mock WebClient）
8. [x] 配置 JaCoCo 代码覆盖率报告
9. [ ] 配置统一日志格式（Logback + JSON 结构化输出）
10. [x] 验证整体覆盖率 >= 80%

## 验收标准
- [x] 所有 Service 方法有单元测试
- [x] 所有 Controller 端点有 API 测试
- [x] 行覆盖率 >= 80%
- [x] 分支覆盖率 >= 60%
- [x] 测试可在 CI 中通过 `mvn test` 一键执行
- [ ] 日志输出为结构化 JSON 格式

## 相关文档
- 需求文档：doc/requirements.md #4.4（MAINT-001、MAINT-004）
- 详细设计：doc/detailed-design.md #4.x（类设计）
- 任务文档：doc/tasks/auth.md, doc/tasks/user-management.md
