# EmoMind Spring Boot 版本 — 开发者指引

## 项目定位

EmoMind 是一个心理测评平台，当前分支 `emomind-sb` 正在将后端从 FastAPI 迁移到 Spring Boot 3.2 + Java 17，前端保持 React 19 不变。

**当前阶段**: Phase 1 文档编写已完成，等待进入 Phase 2 项目脚手架搭建。

## 技术栈

- **后端**: Spring Boot 3.2 + Java 17 + Maven + Spring Data JPA + Spring Security + PostgreSQL
- **前端**: React 19 + TypeScript + Vite + TanStack Router/Query + Tailwind CSS + shadcn/ui
- **基础设施**: Docker Compose + Traefik + Nginx + PostgreSQL 17

## 文档入口

所有设计文档在 `doc/` 目录下，新会话必读：

1. `doc/README.md` — 文档结构说明
2. `doc/requirements.md` — 需求规格说明书（功能需求 + 非功能需求）
3. `doc/outline-design.md` — 概要设计（架构、模块划分、技术选型）
4. `doc/detailed-design.md` — 详细设计（数据库、API、类设计、配置）

## 任务跟踪

`doc/tasks/*.md` 包含 12 个功能模块的任务分解，每个文件包含：
- 需求要点
- 设计要点
- 实现步骤（带复选框 `[ ]`）
- 验收标准（带复选框 `[ ]`）

**当前所有任务的复选框均未勾选，表示尚未进入开发阶段。**

## 项目结构

```
emomind-sb/
├── doc/                    ← 设计文档（已完成）
├── frontend/               ← React 前端（复用现有）
├── scripts/                ← 构建脚本
├── compose.yml             ← Docker Compose 生产配置
├── compose.override.yml    ← Docker Compose 开发配置
├── package.json            ← 前端工作区配置
├── bun.lock                ← 前端依赖锁
├── .env.example            ← 环境变量示例
└── README.md               ← 项目说明
```

**注意**: `backend-sb/` 目录尚未创建，将在 Phase 2 初始化。

## 开发环境端口（与原项目隔离）

| 服务 | 端口 |
|------|------|
| PostgreSQL | 5433 |
| Spring Boot API | 8080 |
| Frontend | 5174 |
| Traefik Dashboard | 8091 |
| Adminer | 8082 |
| Mailcatcher Web | 10801 |

## 与原项目的关系

- `emomind/` 目录（同级）= `emo-fastapi_v3` 分支，继续维护 FastAPI 版本
- `emomind-sb/` 目录 = `emomind-sb` 分支，开发 Spring Boot 版本
- 前端代码在两个分支间同步

## 新会话工作流

1. 读取 `CLAUDE.md`（本文件）了解项目概况
2. 读取 `doc/README.md` 了解文档结构
3. 根据当前任务读取对应的 `doc/tasks/*.md`
4. 需要技术细节时查阅 `doc/detailed-design.md` 对应章节
5. 工作完成后在任务文档中更新复选框状态并提交
