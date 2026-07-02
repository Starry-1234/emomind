# 概要设计文档

## 1. 引言

### 1.1 编写目的

本文档描述 EmoMind 心理测评平台的系统架构、模块划分、数据架构、安全架构和部署架构，为详细设计和开发实施提供顶层指导。

### 1.2 设计范围

本文档涵盖以下内容：
- 系统整体架构设计
- 前后端技术选型
- 模块划分及职责定义
- 数据持久化策略
- 安全认证授权机制
- 容器化部署方案
- 接口设计规范

---

## 2. 系统架构

### 2.1 架构风格

采用经典的分层架构（Layered Architecture）结合前后端分离模式：
- **前端**：单页应用（SPA），通过 REST API 与后端通信
- **后端**：分层架构（表示层 → 业务层 → 数据层）
- **数据层**：关系型数据库 PostgreSQL

### 2.2 架构视图

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端层                              │
│         Web 浏览器 / 移动端浏览器 / 微信小程序                 │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTPS / HTTP
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      前端层 (React 19)                        │
│  TanStack Router │ TanStack Query │ Tailwind CSS │ shadcn/ui │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Vite 构建 → Nginx 静态托管                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    网关层 (Traefik)                          │
│         反向代理 │ SSL 终止 │ 负载均衡 │ 路由规则              │
└─────────────────────────────┬───────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐      ┌────────────────────────────┐
│   后端 API (Spring Boot) │      │     Adminer (数据库管理)     │
│  ┌─────────────────────┐│      └────────────────────────────┘
│  │  Spring Security    ││
│  │  JWT 认证/授权       ││
│  ├─────────────────────┤│
│  │  Spring MVC         ││
│  │  REST API 控制器     ││
│  ├─────────────────────┤│
│  │  Service 业务层      ││
│  ├─────────────────────┤│
│  │  Spring Data JPA    ││
│  │  Repository 数据层   ││
│  ├─────────────────────┤│
│  │  AiProxyService      ││
│  │  → ai-runtime sidecar ││
│  └─────────────────────┘│
└────────────┬────────────┘
             │
             ▼
┌────────────────────────────┐
│     数据层 (PostgreSQL 17)  │
│  ┌──────────────────────┐  │
│  │  users               │  │
│  │  file_analysis_report│  │
│  │  test_record         │  │
│  │  user_memory (V4)    │  │
│  │  conversation_meta   │  │
│  └──────────────────────┘  │
│  Flyway 迁移管理            │
│  pgvector 扩展              │
└────────────────────────────┘
                              │
                              ▼
┌────────────────────────────┐
│  AI 边车 (ai-runtime)       │
│  LangGraph + PostgresSaver  │
│  MinMax / Qwen3-Omni       │
└────────────────────────────┘
```

### 2.3 技术架构图

```
                    ┌─────────────┐
                    │   浏览器     │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   Nginx     │
                    │  (前端静态)  │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   Traefik   │
                    │  (网关路由)  │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │ Spring   │     │ Spring   │     │ Spring   │
   │ Boot     │────▶│ Security │────▶│ Data JPA │
   │ (MVC)    │     │ (JWT)    │     │          │
   └────┬─────┘     └──────────┘     └────┬─────┘
        │                                  │
        │         ┌──────────┐            │
        └────────▶│ AiProxy  │◀───────────┘
                  │ Service  │
                  └────┬─────┘
                       │
                       ▼
                  ┌──────────┐
                  │ai-runtime│
                  │ LangGraph│
                  └──────────┘
```

---

## 3. 模块划分

### 3.1 后端模块结构

采用单体分层架构，按职责垂直划分：

```
backend-sb/
├── config/          # 配置类（跨层横切关注点）
│   ├── SecurityConfig
│   ├── WebClientConfig
│   ├── JacksonConfig
│   ├── JpaConfig
│   ├── OpenApiConfig
│   ├── MailConfig
│   └── WebMvcConfig
│
├── controller/      # 表示层：API 端点定义
│   ├── LoginController
│   ├── UserController
│   ├── AnalysisController
│   ├── TestRecordController
│   ├── AdminController
│   ├── AiController
│   └── UtilsController
│
├── service/         # 业务层：业务逻辑编排
│   ├── UserService
│   ├── AnalysisService
│   ├── TestRecordService
│   ├── AdminStatsService
│   ├── AiProxyService
│   └── EmailService
│
├── repository/      # 数据层：数据访问抽象
│   ├── UserRepository
│   ├── FileAnalysisReportRepository
│   └── TestRecordRepository
│
├── entity/          # 数据层：领域模型/ORM 映射
│   ├── User
│   ├── FileAnalysisReport
│   └── TestRecord
│
├── dto/             # 跨层数据传输对象
│   ├── request/     # 入参 DTO
│   └── response/    # 出参 DTO
│
├── security/        # 安全层：认证授权实现
│   ├── JwtTokenProvider
│   ├── JwtAuthenticationFilter
│   ├── StreakUpdateFilter
│   ├── UserDetailsImpl
│   └── UserDetailsServiceImpl
│
├── exception/       # 异常处理层
│   ├── GlobalExceptionHandler
│   ├── ServiceException
│   ├── ResourceNotFoundException
│   └── UnauthorizedException
│
├── mapper/          # 对象映射层
│   └── EntityMapper (MapStruct)
│
└── util/            # 工具类
    ├── PasswordResetTokenUtil
    └── TimeZoneUtil
```

### 3.2 前端模块结构

```
frontend/
├── src/
│   ├── client/          # 自动生成的 API 客户端
│   ├── components/      # UI 组件
│   │   ├── ui/          # 基础 UI 组件（shadcn/ui）
│   │   ├── Admin/       # 管理员页面组件
│   │   ├── Common/      # 通用组件
│   │   ├── Sidebar/     # 侧边栏组件
│   │   ├── UserSettings/# 用户设置组件
│   │   └── chat/        # AI 聊天组件
│   ├── contexts/        # React Context（状态管理）
│   ├── hooks/           # 自定义 Hooks
│   ├── routes/          # 页面路由组件
│   ├── services/        # 手动封装的 API 服务
│   ├── main.tsx         # 应用入口
│   └── index.css        # 全局样式
├── public/              # 静态资源
├── package.json
├── vite.config.ts
└── Dockerfile
```

### 3.3 模块间关系

**后端模块依赖关系：**

```
Controller → Service → Repository → Entity
    ↓           ↓           ↓
   DTO        DTO        Spring Data JPA
    ↓           ↓           ↓
  Request    Response    PostgreSQL

Security (横切): JwtAuthenticationFilter → Controller
               StreakUpdateFilter → Service

Exception (横切): GlobalExceptionHandler → 所有 Controller
```

---

## 4. 数据架构

### 4.1 数据持久化策略

- **ORM 框架**: Hibernate 6.4（JPA 实现）
- **数据库**: PostgreSQL 17
- **连接池**: HikariCP（Spring Boot 默认）
- **迁移工具**: Flyway 10.x
- **JSON 列**: 使用 Hibernate `@JdbcTypeCode(SqlTypes.JSON)` 映射 PostgreSQL JSONB

### 4.2 数据库选型

选择 PostgreSQL 的原因：
- 原生支持 JSONB 类型，适合存储测评题目、答案等半结构化数据
- 强大的全文搜索和索引能力
- 良好的 Spring Data JPA 支持
- 成熟的 Docker 镜像和运维生态

### 4.3 缓存策略

当前版本不引入独立缓存（Redis），原因：
- 业务以 CRUD 为主，读多写少场景不明显
- 数据量较小，数据库查询性能足够
- 减少系统复杂度

未来如需优化，可在以下场景引入缓存：
- 管理员统计数据（变化频率低）
- 用户会话信息（JWT 已支持无状态）

---

## 5. 安全架构

### 5.1 认证机制

**JWT Token 认证：**

```
┌─────────┐                    ┌─────────────┐               ┌──────────┐
│  Client │─── Login Request ─▶│  Spring     │─── Validate ─▶│  User    │
│         │                    │  Security   │    Password   │  DB      │
│         │◀── JWT Token ──────│  Filter     │               │          │
│         │                    └─────────────┘               └──────────┘
│         │                           │
│         │  ┌────────────────────────┘
│         │  │
│         │  ▼
│         │  ┌─────────────┐
└─────────┼──│  Subsequent │
  Bearer  │  │  Requests   │
  Token   │  │  + Token    │
          │  └──────┬──────┘
          │         │
          │    ┌────┴────┐
          │    ▼         ▼
          │ ┌────────┐ ┌──────────┐
          │ │ Validate│ │ Streak   │
          │ │ JWT     │ │ Update   │
          │ └────┬───┘ └────┬─────┘
          │      │          │
          └──────┴──────────┘
                 │
                 ▼
            ┌──────────┐
            │ Controller│
            └──────────┘
```

**Token 结构：**
- Header: `{ "alg": "HS256", "typ": "JWT" }`
- Payload: `{ "sub": "user-uuid", "exp": 1716422400 }`
- Signature: HMACSHA256(base64Url(header) + "." + base64Url(payload), secret)

### 5.2 授权机制

**基于角色的访问控制（RBAC）：**

| 角色 | 标识 | 权限范围 |
|------|------|---------|
| 普通用户 | `is_superuser = false` | 仅操作自己的数据 |
| 超级用户 | `is_superuser = true` | 全局数据管理 |

**权限校验方式：**
- URL 级别：Spring Security 配置
- 方法级别：`@PreAuthorize("hasRole('ADMIN')")`
- 数据级别：Service 层校验资源归属

### 5.3 传输安全

- **HTTPS**: 生产环境强制 HTTPS
- **CORS**: 限制允许的来源域名
- **HSTS**: HTTP Strict Transport Security 头部
- **CSP**: Content Security Policy 防止 XSS

---

## 6. 部署架构

### 6.1 容器化方案

所有服务以 Docker 容器运行：

| 服务 | 镜像 | 说明 |
|------|------|------|
| 前端 | Nginx:1.25 | 静态文件服务 |
| 后端 | eclipse-temurin:21-jre-alpine | Spring Boot 应用 |
| 数据库 | PostgreSQL:17 | 数据持久化 |
| 代理 | Traefik:3.6 | 反向代理和路由 |
| 邮件 | schickling/mailcatcher | 邮件测试（开发环境） |
| DB 管理 | Adminer | 数据库 Web 管理 |

### 6.2 服务编排

使用 Docker Compose 编排服务：

**生产环境（compose.yml）：**
- 启用 Traefik 路由标签
- 使用外部网络 `traefik-public`
- 健康检查自动重启
- 环境变量注入配置

**开发环境（compose.override.yml）：**
- 端口映射供本地访问
- 后端热重载
- 前端开发服务器代理
- Mailcatcher 邮件测试

### 6.3 网络架构

```
Internet
    │
    ▼
┌─────────┐
│ Traefik │─────── HTTPS 443
│ (Edge)  │
└────┬────┘
     │
     ├─── api.emomind.com ──▶ Spring Boot (8080)
     │
     ├─── dashboard.emomind.com ──▶ Nginx (80)
     │
     └─── adminer.emomind.com ──▶ Adminer (8080)

内部网络:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Spring Boot │────▶│  PostgreSQL │     │   Nginx     │
│   (8080)     │     │   (5433)    │     │   (80)      │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 7. 接口设计原则

### 7.1 RESTful 设计规范

- **基础路径**: `/api/v1`
- **资源命名**: 使用名词复数形式（`/users`, `/test-records`）
- **HTTP 方法语义**:
  - GET: 读取资源
  - POST: 创建资源
  - PUT: 完整更新资源
  - PATCH: 部分更新资源
  - DELETE: 删除资源

### 7.2 错误处理规范

**统一错误响应格式：**

```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "error message",
      "type": "error_type"
    }
  ]
}
```

**HTTP 状态码使用：**

| 状态码 | 使用场景 |
|--------|---------|
| 200 OK | 成功响应 |
| 201 Created | 资源创建成功 |
| 204 No Content | 删除成功 |
| 400 Bad Request | 请求参数错误 |
| 401 Unauthorized | 未认证或 Token 无效 |
| 403 Forbidden | 权限不足 |
| 404 Not Found | 资源不存在 |
| 422 Unprocessable Entity | 验证错误 |
| 500 Internal Server Error | 服务器内部错误 |

### 7.3 版本控制策略

- API 版本通过 URL 路径控制：`/api/v1/...`
- 当前仅维护 v1 版本
- 未来版本升级时，通过新增 `/api/v2/` 路径实现并行支持
