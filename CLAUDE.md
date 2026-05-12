# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供在此代码仓库中工作的指导。

## 项目概述

**emomind** 是一个基于 FastAPI 全栈模板构建的心理测评平台，提供用户认证（管理员/普通用户）、心理测评文件分析报告、Dify AI 聊天集成（心理问答咨询）、在线测评以及音视频录制功能。

## 技术栈

- **后端**: FastAPI (Python 3.10+) + SQLModel (ORM) + PostgreSQL + Alembic 迁移 + JWT 认证
- **前端**: React 19 + TypeScript + Vite + TanStack Router + TanStack Query + Tailwind CSS 4.x + shadcn/ui
- **基础设施**: Docker Compose + Traefik（反向代理）+ Mailcatcher（邮件测试）
- **包管理**: `uv`（后端 Python）、`bun`（前端 Node.js）

## 常用命令

### 全栈开发（Docker）
```bash
docker compose watch          # 启动完整栈，支持热重载
docker compose logs           # 查看日志
docker compose logs backend   # 查看后端日志
docker compose down -v        # 停止并清理数据
```

### 前端开发
```bash
bun run dev                   # 启动前端开发服务器 (http://localhost:5173)
bun run lint                  # 使用 Biome 检查代码
bunx playwright test         # E2E 测试
bunx playwright test --ui    # UI 模式下运行 E2E 测试
```

### 后端开发
```bash
cd backend && fastapi dev app/main.py   # 启动后端（从 backend/ 目录）
cd backend && uv sync                   # 安装依赖
uv run prek run --all-files             # 代码检查
bash ./scripts/test.sh                  # 后端测试 (Pytest)
docker compose exec backend bash scripts/tests-start.sh -x  # 在运行中的栈内运行测试
```

### 数据库迁移
```bash
docker compose exec backend bash        # 进入后端容器
alembic revision --autogenerate -m "描述"  # 创建迁移
alembic upgrade head                    # 应用迁移
```

### 生成 API 客户端
```bash
bash ./scripts/generate-client.sh
```

## 架构

### 后端结构 (`backend/app/`)
- `main.py` - FastAPI 应用工厂
- `models.py` - SQLModel 数据库模型（User, Item, FileAnalysisReport）
- `crud.py` - 增删改查操作
- `core/config.py` - Pydantic 配置管理
- `core/security.py` - JWT 和密码工具
- `api/routes/` - API 端点（login, users, items, analysis, utils, private）
- `alembic/versions/` - 数据库迁移文件

### 前端结构 (`frontend/src/`)
- `main.tsx` - React 应用引导，包含 QueryClient 和 Router
- `routes/` - 按路由组织的页面组件（login, signup, admin/*, user/*）
- `components/` - UI 组件（ui/, Admin/, Common/, Items/, Sidebar/, contexts/）
- `hooks/` - 自定义 Hooks（useAuth.ts, useCustomToast.ts, useMobile.ts）
- `services/` - API 服务（analysisApi.ts, difyApi.ts 用于 Dify AI 集成）
- `client/` - 自动生成的 OpenAPI 客户端

### API 路由（后端，`/api/v1/`）
- `/login` - 认证
- `/users` - 用户管理（增删改查）
- `/items` - 项目管理
- `/analysis` - 文件分析报告管理
- `/utils` - 工具端点（健康检查）
- `/private` - 本地开发专用端点

### 前端路由
- 认证相关: `/login`, `/signup`, `/recover-password`, `/reset-password`
- 管理员（超级用户）: `/admin/*`
- 普通用户: `/user/*`

## 服务地址（开发环境）

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 API | http://localhost:8000 |
| API 文档 (Swagger) | http://localhost:8000/docs |
| Adminer（数据库管理） | http://localhost:8080 |
| Traefik | http://localhost:8090 |
| Mailcatcher | http://localhost:1080 |

## 关键配置

- `.env` - 环境变量（SECRET_KEY, FIRST_SUPERUSER_PASSWORD, POSTGRES_PASSWORD, SMTP 配置）
- `compose.yml` - Docker Compose 主配置
- `compose.override.yml` - 开发环境覆盖配置（实时代码挂载、热重载）
- `backend/alembic.ini` - Alembic 迁移配置
- `frontend/vite.config.ts` - Vite 打包配置
- `frontend/playwright.config.ts` - Playwright E2E 测试配置

## 认证

基于 JWT 的角色访问控制：
- **普通用户** (`is_superuser=false`) → `/user/*` 路由
- **超级用户** (`is_superuser=true`) → `/admin/*` 路由

登录后根据用户角色重定向，未认证访问重定向到 `/login`。

## 外部集成

**Dify AI 平台**: `frontend/src/services/difyApi.ts` 提供流式聊天、文件上传、对话管理和消息历史功能，用于 AI 驱动的心理问答咨询。