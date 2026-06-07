# EmoMind Spring Boot 版本 — 开发者指引

## 项目定位

EmoMind 是一个心理测评平台，当前分支 `emomind-sb` 已将后端从 FastAPI 迁移到 Spring Boot 3.2 + Java 17，前端保持 React 19 不变。

**当前阶段**: Phase 3 功能开发接近完成，进入收尾与验证阶段。

## 技术栈

- **后端**: Spring Boot 3.2 + Java 17 + Maven + Spring Data JPA + Spring Security + PostgreSQL
- **前端**: React 19 + TypeScript + Vite + TanStack Router/Query + Tailwind CSS + shadcn/ui
- **基础设施**: Docker Compose + Traefik + Nginx + PostgreSQL 17
- **测试**: JUnit 5 + Mockito（后端）+ Playwright（前端 E2E）

## 文档入口

所有设计文档在 `doc/` 目录下：

1. `doc/README.md` — 文档结构说明
2. `doc/requirements.md` — 需求规格说明书
3. `doc/outline-design.md` — 概要设计
4. `doc/detailed-design.md` — 详细设计

## 任务跟踪

`doc/tasks/*.md` 包含 15 个功能模块的任务分解。

**总体进度**: 212 / 214 复选框已完成（99%）。

**剩余未完成项**（2 个）：
- `doc/tasks/frontend-cleanup.md` — `[ ]` 验证前端功能正常
- `doc/tasks/performance.md` — `[ ]` 前端页面加载时间 < 3 秒（Lighthouse 评分）— 需浏览器环境

## 项目结构

```
emomind-sb/
├── backend-sb/             ← Spring Boot 后端（已完成核心开发）
│   ├── src/main/java/      ← 业务代码（controller, service, entity, security...）
│   ├── src/test/java/      ← 单元测试与集成测试
│   ├── src/main/resources/db/migration/  ← Flyway 迁移脚本（V1~V3）
│   └── Dockerfile
├── frontend/               ← React 19 + TypeScript + Vite 前端
│   ├── src/routes/         ← TanStack Router 页面
│   ├── src/components/     ← UI 组件（shadcn/ui + 自定义）
│   ├── src/services/       ← API 客户端
│   ├── tests/              ← Playwright E2E 测试
│   └── Dockerfile
├── dify_workflow/          ← Dify AI 工作流 DSL 文件
├── doc/                    ← 设计文档与任务分解
├── scripts/                ← 构建脚本（含 OpenAPI 客户端生成）
├── compose.yml             ← Docker Compose 生产配置（含 Traefik 代理）
├── compose.override.yml    ← Docker Compose 开发配置（端口暴露 + 开发工具）
├── package.json            ← 前端工作区配置
├── bun.lock                ← 前端依赖锁
├── .env.example            ← 环境变量示例
└── README.md               ← 完整项目说明（含 Dify 部署指南）
```

## 后端模块概览（backend-sb/）

| 模块 | 状态 | 关键类 |
|------|------|--------|
| 数据库 / JPA | 完成 | User, TestRecord, FileAnalysisReport, PasswordResetToken |
| 安全 / JWT | 完成 | SecurityConfig, JwtTokenProvider, JwtAuthenticationFilter, StreakUpdateFilter |
| 认证 | 完成 | LoginController（登录/注册/Token验证/密码重置/修改密码） |
| 用户管理 | 完成 | UserController, UserService |
| 测评记录 | 完成 | TestRecordController, TestRecordService |
| 分析报告 | 完成 | AnalysisReportController, AnalysisReportService |
| Dify AI 代理 | 完成 | DifyService（SSE 流式） |
| 管理员统计 | 完成 | AdminController, AdminStatsService |
| 工具接口 | 完成 | UtilsController |
| Flyway 迁移 | 完成 | V1_init_schema, V2_seed_superuser, V3_add_password_reset_tokens |
| 测试覆盖 | 完成 | Controller / Service / Security / Entity / Config 测试 |

## 开发环境端口

| 服务 | URL / 端口 |
|------|-----------|
| Frontend | http://localhost:5174 |
| Backend API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Adminer (DB) | http://localhost:8082 |
| Traefik Dashboard | http://localhost:8091 |
| Mailcatcher | http://localhost:10801 |
| PostgreSQL | localhost:5433 |

## 快速启动

> 完整版（含 Dify 部署截图）见 `README.md`。以下为精简命令速查。

### 前置条件

| 工具 | 版本 | 用途 |
|------|------|------|
| Docker Desktop | Latest | PostgreSQL、Traefik、Mailcatcher |
| Bun | 1.x | 前端包管理与开发服务器 |
| JDK | 17+ | Spring Boot 运行时 |
| Maven | 3.9+ | Java 依赖管理 |

### 1. 部署 Dify（必需依赖）

EmoMind 依赖 Dify 提供 AI 对话和测评工作流，必须先单独启动 Dify：

```bash
git clone https://github.com/langgenius/dify.git
cd dify/docker
cp .env.example .env
docker compose up -d
# 然后访问 http://localhost/install 完成初始化
```

### 2. 导入 Dify 工作流并获取 API Key

1. 打开 Dify Studio → **Create Application** → **Import DSL**
2. 导入 `dify_workflow/智能心理医生_v0.1.yml` 和 `dify_workflow/智能心理测评_v0.1.yml`
3. 进入每个应用 → **API Access** → **Generate API Key**
4. 将 Key 填入 EmoMind 的 `.env`：
   - `智能心理医生` → `DIFY_AI_DOCTOR_API_KEY`
   - `智能心理测评` → `DIFY_TEST_API_KEY`

### 3. 配置环境变量

```bash
cp .env.example .env
```

至少修改以下变量：

```env
SECRET_KEY=your-random-secret
POSTGRES_PASSWORD=your-db-password
FIRST_SUPERUSER_PASSWORD=your-admin-password
DIFY_API_URL=http://your_lan_ip:5001/v1   # 根据部署场景调整
DIFY_AI_DOCTOR_API_KEY=your-ai-doctor-key
DIFY_TEST_API_KEY=your-test-key
VITE_API_URL=http://localhost:8080
```

> **Windows 注意**: 若 Dify 和 EmoMind backend 都在 Docker 外运行，用 `http://localhost:5001/v1`；若 backend 在 Docker 内，用宿主机真实 LAN IP（如 `http://192.168.x.x:5001/v1`），`host.docker.internal` 在 Windows 上不可靠。

### 4. 开发模式启动（推荐日常开发）

**Step 1 — 基础设施服务**:

```bash
docker compose -f compose.override.yml up -d db mailcatcher
```

**Step 2 — 后端**:

```bash
cd backend-sb
set -a && source ../.env && set +a && mvn spring-boot:run
```

**Step 3 — 前端**:

```bash
cd frontend
bun install
bun run dev
```

访问 http://localhost:5174

### 5. 生产模式部署

```bash
# 1. 编译后端 JAR（Dockerfile 依赖）
cd backend-sb && mvn clean package -DskipTests && cd ..

# 2. 启动所有服务（含 Traefik）
docker compose -f compose.yml up -d --build
```

> | 服务 | URL | 说明 |
> |------|-----|------|
> | 前端 | http://dashboard.localhost:8081 | Traefik 路由（hosts 加 `127.0.0.1 dashboard.localhost`）|
> | 后端 API | http://api.localhost:8081 | Traefik 路由（hosts 加 `127.0.0.1 api.localhost`）|
> | Swagger UI | http://api.localhost:8081/swagger-ui.html | Traefik 路由 |
> | Traefik Dashboard | http://localhost:8091 | 直接端口 |
> | Adminer | http://adminer.localhost:8081 | Traefik 路由（hosts 加 `127.0.0.1 adminer.localhost`）|
>
> Traefik 使用非标准端口 `8085/8443` 避免本地冲突，真实服务器可改回 `80/443`。

### 常用开发命令

```bash
# 后端测试
cd backend-sb && mvn test

# 生成前端 OpenAPI 客户端（backend 变更后）
bash ./scripts/generate-client.sh

# 停止开发基础设施
docker compose -f compose.override.yml down

# 停止生产部署
docker compose -f compose.yml down
```

## 与原项目的关系

- `emomind/` 目录（同级）= `emo-fastapi_v3` 分支，继续维护 FastAPI 版本
- `emomind-sb/` 目录 = `emomind-sb` 分支，开发 Spring Boot 版本
- 前端代码在两个分支间同步

## 新会话工作流

1. 读取 `CLAUDE.md`（本文件）了解项目概况
2. 如需了解任务细节，读取 `doc/tasks/*.md`
3. 需要技术细节时查阅 `doc/detailed-design.md` 对应章节
4. **当前优先处理**: 完成剩余 2 个未勾选的验收项（前端功能验证 + Lighthouse 性能）
