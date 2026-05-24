# OpenAPI 文档兼容任务文档

## 任务概述
- **功能描述**: 使用 springdoc-openapi 生成与前端兼容的 OpenAPI 3.0 文档
- **涉及模块**: config, controller, dto
- **依赖任务**: 所有业务模块完成后执行

## 需求要点
- 生成 OpenAPI 3.0 格式的 API 文档
- 文档路径使用 Spring Boot 默认路径（/v3/api-docs, /swagger-ui.html）
- 所有响应格式、字段名、类型与前端期望完全一致
- 支持前端自动生成 TypeScript 客户端

## 设计要点
- **关键类**: OpenApiConfig, 所有 Controller 的注解
- **数据流**: 注解 → springdoc-openapi → OpenAPI JSON → 前端代码生成
- **边界条件**: 字段名精确匹配、枚举值匹配、分页响应格式匹配

## 实现步骤
1. [x] 配置 springdoc-openapi（路径、标题、版本）
2. [x] 为所有 Controller 添加 @Tag 注解
3. [x] 为所有 Operation 添加 @Operation 注解
4. [x] 为所有参数添加 @Parameter 注解
5. [x] 验证生成的 OpenAPI JSON 结构
6. [ ] 对比字段名与前端期望的一致性
7. [ ] 生成前端客户端并验证编译
8. [ ] 修复不兼容的字段或格式

## 验收标准
- [x] OpenAPI 文档可在 /v3/api-docs 访问
- [x] Swagger UI 可在 /swagger-ui.html 访问
- [x] 所有端点正确生成
- [ ] 字段名与前端期望完全一致
- [ ] 前端代码生成成功且无编译错误
- [ ] 分页响应格式匹配
- [ ] 验证错误格式匹配

## 相关文档
- 需求文档：doc/requirements.md #4.4
- 详细设计：doc/detailed-design.md #7.1