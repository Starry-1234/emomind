# 安全设计任务文档

## 任务概述
- **功能描述**: JWT 认证、密码哈希、CORS、角色授权、全局异常处理
- **涉及模块**: security, config, exception
- **依赖任务**: auth, database

## 需求要点
- JWT Token 使用 HS256 签名，有效期 8 天
- 密码使用 BCrypt 哈希存储（强度 10）
- 支持角色访问控制（普通用户 / 超级用户）
- CORS 限制允许的来源
- 统一异常处理（400/401/403/404/422/500）

## 设计要点
- **关键类**: JwtTokenProvider, JwtAuthenticationFilter, StreakUpdateFilter, SecurityConfig, GlobalExceptionHandler
- **数据流**: Request → JwtAuthenticationFilter → StreakUpdateFilter → Controller
- **边界条件**: Token 过期、签名验证失败、权限不足、参数验证失败

## 实现步骤
1. [x] 配置 SecurityConfig（过滤器链、CORS、CSRF）
2. [x] 实现 JwtTokenProvider（签发/验证/解析）
3. [x] 实现 JwtAuthenticationFilter（从请求头提取 Token）
4. [x] 实现 StreakUpdateFilter（更新连续活跃天数）
5. [x] 实现 UserDetailsImpl 和 UserDetailsServiceImpl
6. [x] 配置角色注解（@PreAuthorize）
7. [x] 实现 GlobalExceptionHandler（统一异常处理）
8. [x] 配置 422 验证错误格式（兼容前端）
9. [x] 单元测试（TokenProvider, Filter）

## 验收标准
- [x] JWT 签发和验证正常工作
- [x] Token 过期返回 401
- [x] 无效 Token 返回 401
- [x] 密码哈希强度符合要求
- [x] 普通用户无法访问管理员接口（返回 403）
- [x] CORS 配置正确（仅允许配置的来源）
- [x] 参数验证错误返回 422（格式兼容）
- [x] 全局异常捕获所有未处理异常

## 相关文档
- 需求文档：doc/requirements.md #4.2
- 详细设计：doc/detailed-design.md #4.6, #6, #7.1
