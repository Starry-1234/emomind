# EmoMind Spring Boot 后端 MVP 核心链路设计

## 1. 项目背景

EmoMind 心理测评平台后端从 FastAPI 迁移到 Spring Boot 3.2 + Java 17。本文档定义 MVP 核心链路的实施级设计，基于项目 `doc/` 目录下的现有设计文档。

## 2. 范围

### 2.1 包含模块（5个，严格串行 TDD）

| 序号 | 模块 | 核心交付物 | 前置依赖 |
|------|------|-----------|---------|
| 1 | database | JPA Entity ×3、Repository ×3、Flyway V1/V2 | 无 |
| 2 | security | SecurityConfig、JwtTokenProvider、Filter ×2、ExceptionHandler | database |
| 3 | auth | LoginController、UserService（认证部分）、密码重置 | security |
| 4 | user-management | UserController、UserService（CRUD）、管理员接口 | auth |
| 5 | health-check | UtilsController、健康检查端点 | 无（可并行于 auth） |

### 2.2 不包含（后续迭代）

- analysis-report 模块（文件分析报告 CRUD）
- test-record 模块（测评记录 CRUD）
- dify-proxy 模块（Dify AI SSE 代理）
- admin-stats 模块（管理员仪表盘统计）
- openapi 文档生成验证
- frontend-cleanup
- deployment 配置调优
- testing 覆盖率（>80% 在完整迭代中达成）
- performance 优化

## 3. 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 语言 | Java | 21 (LTS) |
| 框架 | Spring Boot | 3.2 |
| 构建 | Maven | 3.9+ |
| ORM | Spring Data JPA + Hibernate | 6.4 |
| 数据库 | PostgreSQL | 17 |
| 迁移 | Flyway | 10.x |
| 安全 | Spring Security + JWT (jjwt) | - |
| 密码哈希 | BCrypt (Spring Security) | 强度 10 |
| 对象映射 | MapStruct | - |
| API 文档 | springdoc-openapi | - |
| 测试 | JUnit 5 + Mockito + Spring Boot Test | - |

## 4. 架构设计

### 4.1 分层架构

```
Controller (表示层)
    ├── LoginController
    ├── UserController
    └── UtilsController

Service (业务层)
    ├── UserService（认证 + CRUD）
    └── AdminStatsService（预留）

Security (安全层)
    ├── JwtTokenProvider
    ├── JwtAuthenticationFilter
    ├── StreakUpdateFilter
    ├── UserDetailsImpl
    ├── UserDetailsServiceImpl
    └── SecurityConfig

Repository (数据层)
    ├── UserRepository
    ├── FileAnalysisReportRepository
    └── TestRecordRepository

Entity (领域模型)
    ├── User
    ├── FileAnalysisReport
    └── TestRecord

Exception (异常处理)
    ├── GlobalExceptionHandler
    ├── ServiceException
    ├── ResourceNotFoundException
    └── UnauthorizedException
```

### 4.2 认证流程

```
Client → POST /login/access-token
    → LoginController
    → UserService.authenticate()
    → BCryptPasswordEncoder.matches()
    → JwtTokenProvider.generateToken()
    ← TokenResponse

Client → 后续请求 (Bearer Token)
    → JwtAuthenticationFilter
    → JwtTokenProvider.validateToken()
    → UserDetailsServiceImpl.loadUserByUsername()
    → StreakUpdateFilter (更新 streak)
    → Controller
```

## 5. 数据模型

### 5.1 实体关系

```
User (1) ──────< FileAnalysisReport (N)
User (1) ──────< TestRecord (N)
```

### 5.2 User 实体

| 字段 | 类型 | 约束 | 默认值 |
|------|------|------|--------|
| id | UUID | PK, gen_random_uuid() | - |
| email | VARCHAR(255) | NOT NULL, UNIQUE | - |
| hashedPassword | VARCHAR | NOT NULL | - |
| isActive | BOOLEAN | NOT NULL | TRUE |
| isSuperuser | BOOLEAN | NOT NULL | FALSE |
| fullName | VARCHAR(255) | NULL | - |
| streakDays | INTEGER | NOT NULL | 0 |
| lastActiveDate | TIMESTAMP | NULL | - |
| createdAt | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP |

### 5.3 FileAnalysisReport 实体

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | - |
| fileName | VARCHAR(255) | NOT NULL | - |
| fileType | VARCHAR(50) | NOT NULL | - |
| fileSize | INTEGER | NULL | 字节 |
| analysisResult | TEXT | NOT NULL | - |
| conversationId | VARCHAR | NULL | Dify 对话 ID |
| createdAt | TIMESTAMP | NOT NULL | - |
| ownerId | UUID | FK → users.id, ON DELETE CASCADE | - |

### 5.4 TestRecord 实体

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | - |
| testName | VARCHAR(255) | NOT NULL | - |
| userTopic | VARCHAR(500) | NULL | - |
| totalScore | INTEGER | NULL | - |
| totalMax | INTEGER | NULL | - |
| resultDescription | TEXT | NULL | - |
| questions | JSONB | NOT NULL | 题目列表 |
| answers | JSONB | NOT NULL | 答案列表 |
| scoringRanges | JSONB | NULL | 评分区间 |
| conversationId | VARCHAR | NULL | - |
| createdAt | TIMESTAMP | NOT NULL | - |
| ownerId | UUID | FK → users.id, ON DELETE CASCADE | - |

## 6. API 设计

### 6.1 认证相关

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/v1/login/access-token | OAuth2 Password Flow 登录 | 公开 |
| POST | /api/v1/login/test-token | 验证 Token 返回用户信息 | 需认证 |
| POST | /api/v1/password-recovery/{email} | 发送密码重置邮件 | 公开 |
| POST | /api/v1/reset-password/ | 使用重置 Token 修改密码 | 公开 |
| POST | /api/v1/users/signup | 用户注册 | 公开 |
| PATCH | /api/v1/users/me/password | 修改当前用户密码 | 需认证 |

### 6.2 用户管理

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/users/me | 获取当前用户信息 | 需认证 |
| PATCH | /api/v1/users/me | 更新当前用户信息 | 需认证 |
| DELETE | /api/v1/users/me | 删除当前用户 | 需认证 |
| GET | /api/v1/users/ | 获取所有用户列表 | 超级用户 |
| POST | /api/v1/users/ | 创建用户 | 超级用户 |
| GET | /api/v1/users/{id} | 获取指定用户 | 超级用户 |
| PATCH | /api/v1/users/{id} | 更新指定用户 | 超级用户 |
| DELETE | /api/v1/users/{id} | 删除指定用户 | 超级用户 |

### 6.3 健康检查

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/utils/health-check/ | 服务健康状态 | 公开 |

## 7. 安全设计

### 7.1 JWT 配置

- 算法：HS256
- 有效期：8 天（691200000 ms）
- Payload：`{ "sub": "user-uuid", "exp": timestamp }`
- Secret：从环境变量 `SECRET_KEY` 注入

### 7.2 密码安全

- 哈希算法：BCrypt
- 强度：10
- 兼容：支持旧系统 Argon2 哈希（DelegatingPasswordEncoder）

### 7.3 CORS

- 允许来源：从 `BACKEND_CORS_ORIGINS` 环境变量配置
- 默认开发环境：`http://localhost:5174`

### 7.4 角色授权

- 普通用户：`is_superuser = false`，只能操作自己的数据
- 超级用户：`is_superuser = true`，可管理所有数据
- URL 级别：Spring Security 配置
- 方法级别：`@PreAuthorize("hasRole('ADMIN')")`

## 8. 错误响应格式

### 8.1 验证错误（422）

```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "error message",
      "type": "value_error"
    }
  ]
}
```

### 8.2 业务错误（400/401/403/404/500）

```json
{
  "message": "error description"
}
```

## 9. 配置设计

### 9.1 application.yml 核心配置

```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:postgresql://${POSTGRES_SERVER:localhost}:${POSTGRES_PORT:5433}/${POSTGRES_DB:emomind}
    username: ${POSTGRES_USER:postgres}
    password: ${POSTGRES_PASSWORD:}
    hikari:
      minimum-idle: 5
      maximum-pool-size: 20

  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        jdbc.time_zone: Asia/Shanghai

  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true

app:
  jwt:
    secret: ${SECRET_KEY:}
    expiration: 691200000
  cors:
    origins: ${BACKEND_CORS_ORIGINS:http://localhost:5174}
  first-superuser:
    email: ${FIRST_SUPERUSER:}
    password: ${FIRST_SUPERUSER_PASSWORD:}
```

## 10. 测试策略

### 10.1 TDD 流程

每个模块遵循：
1. 编写失败测试（Red）
2. 编写最小实现通过测试（Green）
3. 重构（Refactor）
4. 编译验证
5. 进入下一模块

### 10.2 测试覆盖目标

| 模块 | 测试类型 | 覆盖目标 |
|------|---------|---------|
| database | 集成测试（@DataJpaTest） | Entity 映射、Repository 查询 |
| security | 单元测试 + 集成测试 | TokenProvider、Filter 链、PasswordEncoder |
| auth | 集成测试（@SpringBootTest + MockMvc） | 所有端点正例+反例 |
| user-management | 集成测试 | CRUD 操作、权限边界 |
| health-check | 集成测试 | 端点响应格式 |

## 11. 开发环境

| 服务 | 端口 |
|------|------|
| PostgreSQL | 5433 |
| Spring Boot API | 8080 |
| Frontend | 5174 |
| Traefik Dashboard | 8091 |
| Adminer | 8082 |
| Mailcatcher Web | 10801 |

## 12. 关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据库时区 | 应用层 Asia/Shanghai | 需求约束，数据库用无时区 TIMESTAMP |
| JSON 存储 | PostgreSQL JSONB + Hibernate @JdbcTypeCode | 原生支持，性能优秀 |
| 主键生成 | Hibernate UUID（GenerationType.UUID） | 分布式安全，与现有前端兼容 |
| 邮件服务 | Spring Mail + Mailcatcher（开发） | 标准方案，易于切换生产 SMTP |
| 流式响应 | 预留 StreamingResponseBody 接口 | MVP 不包含 dify-proxy，但接口预留 |

## 13. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 旧 Argon2 密码兼容 | 迁移用户无法登录 | DelegatingPasswordEncoder 支持多算法 |
| 前端 OpenAPI 客户端不兼容 | API 契约变更 | 严格遵循 detailed-design.md 中的 API 定义 |
| JSONB 列 JPA 映射异常 | 测评记录无法保存 | 使用 @JdbcTypeCode(SqlTypes.JSON) 精确映射 |
| streak 计算时区问题 | 连续活跃天数统计错误 | 统一使用 Asia/Shanghai，测试覆盖跨天场景 |

## 14. 验收标准

### 14.1 每个模块的通用验收标准

- [ ] `./mvnw test` 全部通过
- [ ] `./mvnw compile` 无错误
- [ ] 新增代码符合 Checkstyle/Spring 编码规范

### 14.2 模块特定验收标准

**database**
- [ ] 所有表结构正确创建
- [ ] Flyway 迁移可重复执行
- [ ] JSON 列可正常读写

**security**
- [ ] JWT 签发和验证正常工作
- [ ] Token 过期返回 401
- [ ] 无效 Token 返回 401
- [ ] 普通用户无法访问管理员接口（403）
- [ ] 参数验证错误返回 422（格式兼容）

**auth**
- [ ] 用户可正常注册并登录
- [ ] 密码重置邮件正常发送
- [ ] 每次认证请求 streak 正确更新

**user-management**
- [ ] 普通用户只能操作自己的数据
- [ ] 管理员可管理所有用户
- [ ] 删除用户级联删除关联数据

**health-check**
- [ ] GET /api/v1/utils/health-check/ 返回 {status: "ok"}
