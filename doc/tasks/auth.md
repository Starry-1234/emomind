# 认证模块任务文档

## 任务概述
- **功能描述**: 用户注册、登录、Token 验证、密码重置、密码修改、连续活跃天数更新
- **涉及模块**: controller, service, security, entity, dto
- **依赖任务**: database, security

## 需求要点
- 用户通过邮箱和密码注册，邮箱唯一
- 登录采用 OAuth2 Password Flow，返回 JWT Token
- Token 有效期 8 天，使用 HS256 签名
- 密码重置通过邮件发送重置链接（48 小时有效）
- 每次认证请求自动更新 streak_days 和 last_active_date

## 设计要点
- **关键类**: LoginController, UserService, JwtTokenProvider, JwtAuthenticationFilter, StreakUpdateFilter
- **数据流**: Client → LoginController → UserService → UserRepository → PostgreSQL
- **边界条件**: 邮箱格式验证、密码最少 8 位、Token 过期处理、streak 跨天计算

## 实现步骤
1. [x] 编写 JWT TokenProvider（签发/验证/解析）
2. [x] 配置 Spring Security（SecurityConfig）
3. [x] 实现 JwtAuthenticationFilter（Token 解析过滤器）
4. [x] 实现 StreakUpdateFilter（连续活跃更新过滤器）
5. [x] 编写登录接口（/login/access-token）
6. [x] 编写 Token 验证接口（/login/test-token）
7. [x] 编写注册接口（/users/signup）
8. [x] 编写密码重置接口（/password-recovery/{email}）
9. [x] 编写密码修改接口（/reset-password/）
10. [x] 编写修改密码接口（/users/me/password）
11. [x] 单元测试（TokenProvider, Filter, Controller）

## 验收标准
- [x] 用户可正常注册并登录
- [x] Token 签发和验证正常工作
- [x] Token 过期后返回 401
- [x] 密码重置邮件正常发送
- [x] 密码重置链接 48 小时后失效
- [x] 每次认证请求 streak 正确更新
- [x] 连续登录 streak 累加，中断后重置为 1
- [x] 同一天多次请求 streak 不重复增加

## 相关文档
- 需求文档：doc/requirements.md #3.1
- 详细设计：doc/detailed-design.md #3.1, #4.6, #5.1, #5.2, #5.3
