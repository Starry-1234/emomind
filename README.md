# EmoMind

[English Version](README.md)

心理测评平台，支持 AI 聊天、在线测评、文件分析和多主题切换。

## 主要功能

- **用户认证**
  - JWT 登录/注册，基于角色的访问控制（管理员 / 普通用户）
  - 密码找回与重置

- **AI 心理医生**
  - LangGraph + Python 边车驱动的 AI 心理咨询
  - 流式输出，支持暂停/继续
  - 消息复制与重新生成，多版本切换
  - 会话历史管理

- **在线心理测评**
  - 交互式心理量表测评
  - 实时评分与进度追踪
  - AI 自动生成分析报告
  - 测评记录历史

- **文件分析**
  - 上传心理测评文件进行 AI 分析
  - 生成可下载的分析报告

- **管理后台**
  - 用户管理
  - 聊天历史概览
  - 测评记录管理
  - 系统统计数据

- **主题**
  - 深色 / 浅色 / 暖色主题切换

## 技术栈

**后端**: Spring Boot 3.2 + Java 17 + Maven + Spring Data JPA + Spring Security + PostgreSQL

**前端**: React 19 + TypeScript + Vite + TanStack Router + TanStack Query + Tailwind CSS + shadcn/ui

**AI 集成**: 自建 LangGraph + Python 边车（FastAPI / SSE 流式 / 多 LLM 提供商）

**基础设施**: Docker Compose + Traefik + Nginx + Mailcatcher

## 快速开始

### 前置要求

| 工具 | 版本 | 用途 |
|------|------|------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop) | 最新版 | 运行 PostgreSQL、Traefik、Mailcatcher 及生产构建 |
| [Git](https://git-scm.com/) | 最新版 | 克隆仓库 |
| [Bun](https://bun.sh/) | 1.x | 前端包管理器及开发服务器 |
| [JDK](https://adoptium.net/) | 17+ | Spring Boot 后端运行环境 |
| [Maven](https://maven.apache.org/) | 3.9+ | Java 依赖管理 |

> **Windows 用户**：确保 Docker Desktop 运行在 WSL2 模式下，并启用 "Docker Desktop WSL 2 backend" 功能。

### 1. 克隆项目

```bash
git clone https://github.com/Starry-1234/emomind.git
cd emomind
```

### 2. 部署 ai-runtime（必需）

EmoMind 的 AI 能力由 `ai-runtime`（Python FastAPI + LangGraph）提供，与后端 Spring Boot 一起在 docker compose 中启动。前端请求经 Spring 鉴权后转发到 ai-runtime。

```bash
# 启动基础设施（PostgreSQL + Redis + Mailcatcher）
docker compose -f compose.yml -f compose.override.yml up -d db redis mailcatcher

# 启动后端与 ai-runtime
docker compose -f compose.yml -f compose.override.yml up -d backend ai-runtime
```

启动后验证：

```bash
curl http://localhost:8000/healthz
# 期望：{"status":"ok","service":"ai-runtime"}
```

### 3. 配置 LLM 提供商 API Key

ai-runtime 通过环境变量读取 LLM 凭证（从 `.env` 注入）。复制 `.env.example` 为 `.env` 并填写：

```bash
# .env（节选）
MINIMAX_API_KEY=your-minimax-key              # 文本 LLM（MinMax / OpenAI 兼容）
MINIMAX_BASE_URL=https://api.minimax.chat/v1
QWEN_OMNI_API_KEY=your-qwen-key              # 多模态 LLM（Qwen3-Omni / DashScope 兼容）
QWEN_OMNI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_API_KEY=your-qwen-key              # 向量嵌入（默认与 Qwen 共用）
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_MODEL=text-embedding-v3
LANGGRAPH_INTERNAL_TOKEN=changeme-32-chars-min-internal-token   # Spring ↔ ai-runtime 内部鉴权
```

完整变量清单见 `compose.yml` 与 `.env.example`。

### 4. 配置 EmoMind 环境

```bash
cp .env.example .env
```

编辑 `.env`，至少修改以下变量：

```env
# 安全 — 请修改默认值！
SECRET_KEY=your-random-secret-string
POSTGRES_PASSWORD=your-db-password
FIRST_SUPERUSER_PASSWORD=your-admin-password

# LangGraph / ai-runtime 连接
LANGGRAPH_RUNTIME_URL=http://localhost:8000   # Spring → ai-runtime 内网地址
LANGGRAPH_INTERNAL_TOKEN=changeme-32-chars-min-internal-token
LANGGRAPH_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/emomind
LANGGRAPH_REDIS_URL=redis://localhost:6390
LANGGRAPH_STORAGE_PATH=./ai-runtime-files

# LLM 提供商
MINIMAX_API_KEY=your-minimax-key
MINIMAX_BASE_URL=https://api.minimax.chat/v1
QWEN_OMNI_API_KEY=your-qwen-key
QWEN_OMNI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_API_KEY=your-qwen-key
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_MODEL=text-embedding-v3

# 前端
VITE_API_URL=http://localhost:8080
```

### 5. 启动 EmoMind（开发模式）

开发模式下后端和前端**不**运行在 Docker 中，以获得热重载支持；PostgreSQL 等基础服务仍通过 Docker 运行。

**步骤 1 — 基础服务**：

```bash
docker compose up -d db mailcatcher
```

这会启动 PostgreSQL（端口 `5433`）和 Mailcatcher（端口 `10801`）。

**步骤 2 — 后端**：

```bash
cd backend-sb
set -a && source ../.env && set +a && mvn spring-boot:run
```

> `set -a` 的作用是让 `source ../.env` 加载的变量自动 export 为环境变量，否则 Spring Boot 读不到 `.env` 里的配置。等待出现 `Started EmoMindApplication in ... seconds` 即可。

**步骤 3 — 前端**：

```bash
cd frontend
bun install
bun run dev
```

在浏览器打开 http://localhost:5174 即可使用。

### 6. 部署 EmoMind（生产模式）

生产模式会将所有服务构建为 Docker 镜像，并通过 Traefik 反向代理运行。

```bash
# 步骤 1 — 编译后端 JAR（Dockerfile 需要）
cd backend-sb && mvn clean package -DskipTests && cd ..

# 步骤 2 — 启动所有服务
# compose.yml 提供核心服务 + Traefik；compose.override.yml 暴露本地端口
docker compose up -d --build
```

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5174 |
| 后端 API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Traefik Dashboard | http://localhost:8091 |
| Adminer（数据库管理）| http://localhost:8082 |
| Mailcatcher | http://localhost:10801 |

> 在真实服务器上使用公网域名时，可用 `docker compose -f compose.yml up -d --build`（不加 override），通过 Traefik 在标准端口上路由。

停止服务：

```bash
docker compose -f compose.yml -f compose.traefik.yml down
```

### 开发模式 vs 部署模式

| | 开发模式 | 部署模式 |
|--|----------|----------|
| **后端** | `mvn spring-boot:run`（本地 JVM，热重载，需先 `source ../.env`） | Docker 容器（`docker compose up`） |
| **前端** | `bun run dev`（Vite 开发服务器，HMR） | Docker 容器（Nginx 托管静态构建产物） |
| **数据库** | Docker（`compose.override.yml` 中的 `db` 服务） | Docker（`compose.yml` 中的 `db` 服务） |
| **代理** | 无（直接使用端口） | Traefik（反向代理 + HTTPS） |
| **适用场景** | 日常编码、调试 | 生产服务器、演示、CI/CD |

## 文档

所有设计文档位于 `doc/` 目录下：

| 文档 | 说明 |
|------|------|
| `doc/README.md` | 文档索引和阅读顺序 |
| `doc/requirements.md` | 功能需求和非功能需求 |
| `doc/outline-design.md` | 系统架构和模块设计 |
| `doc/detailed-design.md` | 数据库、API、类和配置详细信息 |
| `doc/tasks/*.md` | 各功能模块的任务分解（含复选框） |

## 项目结构

```
emomind-sb/
├── backend-sb/           # Spring Boot 后端
│   ├── pom.xml
│   └── src/main/java/com/emomind/
│       ├── controller/   # REST API 控制器
│       ├── service/      # 业务逻辑
│       ├── repository/   # Spring Data JPA 仓库
│       ├── entity/       # JPA 实体
│       ├── dto/          # 请求/响应 DTO
│       ├── mapper/       # 实体-DTO 映射器
│       ├── exception/    # 自定义异常
│       ├── security/     # JWT 和认证
│       ├── config/       # 配置类
│       └── resources/
│           ├── application.yml
│           └── db/migration/   # Flyway 迁移
├── frontend/             # React 单页应用
│   ├── src/
│   │   ├── routes/       # TanStack Router 页面
│   │   ├── components/   # 共享 UI 组件
│   │   ├── hooks/        # React hooks（聊天、认证等）
│   │   ├── services/     # API 客户端
│   │   └── client/       # 自动生成的 OpenAPI 客户端
│   └── dist/             # 生产构建输出
├── ai-runtime/           # LangGraph Python 边车（FastAPI + SSE）
├── doc/                  # 设计文档
├── compose.yml           # Docker Compose 生产配置
├── compose.override.yml  # Docker Compose 开发配置
├── scripts/              # 构建和工具脚本
└── .env.example          # 环境变量模板
```

## 开发环境端口

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5174 |
| 后端 API | http://localhost:8080 |
| API 文档（Swagger UI）| http://localhost:8080/swagger-ui.html |
| Adminer（数据库管理）| http://localhost:8082 |
| Traefik Dashboard | http://localhost:8091 |
| Mailcatcher | http://localhost:10801 |
| PostgreSQL | localhost:5433 |

## 开发命令

```bash
# 前端开发（从 frontend/ 目录）
cd frontend && bun install && bun run dev

# 后端开发（从 backend-sb/ 目录，需先加载 .env）
cd backend-sb && set -a && source ../.env && set +a && mvn spring-boot:run

# 运行后端测试
cd backend-sb && mvn test

# 后端接口变更后重新生成前端客户端
bash ./scripts/generate-client.sh
```

## API 概览

- `/api/v1/login` — 认证
- `/api/v1/users` — 用户管理
- `/api/v1/test-records` — 心理测评记录
- `/api/v1/analysis` — 文件分析报告
- `/api/v1/ai/*` — LangGraph AI 集成（聊天 SSE、会话、消息）
- `/api/v1/admin` — 管理员统计和管理
- `/api/v1/utils/health-check` — 健康检查
