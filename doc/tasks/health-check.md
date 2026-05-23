# 健康检查任务文档

## 任务概述
- **功能描述**: 服务健康状态检查端点，用于 Docker 健康检查和负载均衡器探测
- **涉及模块**: controller
- **依赖任务**: 无（基础任务）

## 需求要点
- 提供 /api/v1/utils/health-check/ 端点
- 返回服务状态（ok/error）
- 无需认证

## 设计要点
- **关键类**: UtilsController
- **数据流**: Client → UtilsController → 返回状态
- **边界条件**: 服务启动即健康，无需数据库连接检查

## 实现步骤
1. [ ] 编写 UtilsController
2. [ ] 实现 GET /utils/health-check/
3. [ ] 配置 Spring Security（允许匿名访问）
4. [ ] 配置 Docker healthcheck
5. [ ] 单元测试

## 验收标准
- [ ] 健康检查端点返回 200 + { "status": "ok" }
- [ ] 无需认证即可访问
- [ ] Docker 健康检查正常

## 相关文档
- 需求文档：doc/requirements.md #3.7
- 详细设计：doc/detailed-design.md #3.7