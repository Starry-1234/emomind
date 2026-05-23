# EmoMind

心理测评平台，支持 AI 聊天、在线测评、文件分析和多主题切换。

## 当前状态

**阶段**: 设计文档已完成，等待 Phase 2（项目脚手架搭建）。

本分支（`emomind-sb`）正在将后端从 FastAPI 迁移至 Spring Boot 3.2 + Java 21，React 前端保持不变。

## 主要功能

- **用户认证**
  - JWT 登录/注册，基于角色的访问控制（管理员 / 普通用户）
  - 密码找回与重置

- **AI 心理医生**
  - Dify AI 驱动的聊天式心理咨询
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

**后端**: Spring Boot 3.2 + Java 21 + Maven + Spring Data JPA + Spring Security + PostgreSQL

**前端**: React 19 + TypeScript + Vite + TanStack Router + TanStack Query + Tailwind CSS + shadcn/ui

**AI 集成**: Dify AI 平台（流式聊天、工作流、会话管理）

**基础设施**: Docker Compose + Traefik + Nginx + Mailcatcher

## 文档

所有设计文档位于 `doc/` 目录下：

| 文档 | 说明 |
|------|------|
| `doc/README.md` | 文档索引和阅读顺序 |
| `doc/requirements.md` | 功能需求和非功能需求 |
| `doc/outline-design.md` | 系统架构和模块设计 |
| `doc/detailed-design.md` | 数据库、API、类和配置详细信息 |
| `doc/tasks/*.md` | 各功能模块的任务分解（含复选框） |

## 计划中的项目结构

```
emomind-sb/
├── backend-sb/           # Spring Boot 后端（尚未创建）
│   ├── pom.xml
│   └── src/main/java/com/emomind/
│       ├── controller/   # REST API 控制器
│       ├── service/      # 业务逻辑
│       ├── repository/   # Spring Data JPA 仓库
│       ├── entity/       # JPA 实体
│       ├── dto/          # 请求/响应 DTO
│       ├── security/     # JWT 和认证
│       ├── config/       # 配置类
│       └── resources/
│           ├── application.yml
│           └── db/migration/   # Flyway 迁移
├── frontend/             # React 单页应用（与 FastAPI 版本共用）
├── doc/                  # 设计文档
├── compose.yml           # Docker Compose 生产配置
├── compose.override.yml  # Docker Compose 开发配置
└── scripts/              # 构建和工具脚本
```

## 开发环境端口

端口与原 FastAPI 版本隔离，可同时运行两个版本：

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5174 |
| 后端 API | http://localhost:8080 |
| API 文档 | http://localhost:8080/docs |
| Adminer（数据库管理）| http://localhost:8082 |
| Traefik Dashboard | http://localhost:8091 |
| Mailcatcher | http://localhost:10801 |
| PostgreSQL | localhost:5433 |

## 环境配置

所有配置统一在项目根目录的 `.env` 文件中管理（前后端共用）：

```bash
cp .env.example .env
```

主要配置项：

- `SECRET_KEY` — JWT 签名密钥，改成随机字符串
- `POSTGRES_PASSWORD` — 数据库密码
- `FIRST_SUPERUSER_PASSWORD` — 初始管理员密码
- `DIFY_API_URL` — Dify API 地址（Windows Docker 下用宿主机局域网 IP）
- `DIFY_AI_DOCTOR_API_KEY` — AI 心理医生 Dify API Key
- `DIFY_TEST_API_KEY` — 心理测评 Dify API Key
- `VITE_API_URL` — 前端连接后端的地址（本地开发用 `http://localhost:8080`）

> **注意**：在 Windows + Docker Desktop 环境下，`host.docker.internal` 可能无法正常解析，请使用宿主机的真实局域网 IP（如 `192.168.1.x`）作为 `DIFY_API_URL`。

## 开发命令（计划）

```bash
# 前端开发（从 frontend/ 目录）
cd frontend && bun install && bun run dev

# 后端开发（从 backend-sb/ 目录）
cd backend-sb && ./mvnw spring-boot:run

# 运行后端测试
cd backend-sb && ./mvnw test

# 后端接口变更后重新生成前端客户端
bash ./scripts/generate-client.sh
```

## API 概览

- `/api/v1/login` — 认证
- `/api/v1/users` — 用户管理
- `/api/v1/test-records` — 心理测评记录
- `/api/v1/analysis` — 文件分析报告
- `/api/v1/dify/*` — Dify AI 集成（聊天、会话、消息）
- `/api/v1/admin` — 管理员统计和管理
- `/api/v1/utils/health-check` — 健康检查

## 与 FastAPI 版本的关系

- `emomind/`（同级目录）= `emo-fastapi_v3` 分支，继续维护 FastAPI 版本
- `emomind-sb/`（本目录）= `emomind-sb` 分支，Spring Boot 重新实现
- 前端代码在两个分支间同步
