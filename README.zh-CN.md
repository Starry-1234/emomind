# emomind

心理测评平台，支持 AI 聊天、在线测评、文件分析和多主题切换。

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
  - 系统设置

- **主题**
  - 深色 / 浅色 / 暖色主题切换

## 技术栈

**后端**: FastAPI + SQLModel + PostgreSQL + JWT + Alembic

**前端**: React 19 + TypeScript + Vite + TanStack Router + TanStack Query + Tailwind CSS + shadcn/ui

**AI 集成**: Dify AI 平台（流式聊天、工作流、会话管理）

**基础设施**: Docker Compose + Traefik + Mailcatcher

## 快速启动

```bash
# 启动完整栈，支持热重载
docker compose watch

# 或者普通启动
docker compose up -d
```

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 API | http://localhost:8000 |
| API 文档 | http://localhost:8000/docs |
| Adminer（数据库管理）| http://localhost:8080 |
| Traefik | http://localhost:8090 |
| Mailcatcher | http://localhost:1080 |

## 首次登录

进入后端容器初始化数据库和超级用户：

```bash
docker compose exec backend bash
```

在容器内执行：

```bash
alembic upgrade head
python app/initial_data.py
```

默认管理员账号（首次登录后请修改）：

- 邮箱: `admin@example.com`
- 密码: `changethis`

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
- `VITE_API_URL` — 前端连接后端的地址（本地开发用 `http://localhost:8000`）

> **注意**：在 Windows + Docker Desktop 环境下，`host.docker.internal` 可能无法正常解析，请使用宿主机的真实局域网 IP（如 `192.168.1.x`）作为 `DIFY_API_URL`。

## 开发命令

```bash
# 前端开发（从 frontend/ 目录）
cd frontend && bun install && bun run dev

# 后端开发（从 backend/ 目录）
cd backend && uv sync && fastapi dev app/main.py

# 运行测试
bash ./scripts/test.sh

# 后端接口变更后重新生成前端客户端
bash ./scripts/generate-client.sh
```

## 目录结构

```
backend/app/
  main.py          # FastAPI 应用工厂
  models/          # SQLModel 模型（User, Item, TestRecord, FileAnalysisReport 等）
  repositories/    # 仓库模式（CRUD 操作）
  services/        # 业务逻辑层（Dify, Admin, User, Analysis）
  api/routes/      # API 端点

frontend/src/
  routes/          # 按路由组织的页面组件
  components/      # UI 组件
  hooks/           # 自定义 React hooks
  services/        # API 服务模块（difyApi.ts, analysisApi.ts）
  client/          # 自动生成的 OpenAPI 客户端
```

## API 概览

- `/api/v1/login` — 认证
- `/api/v1/users` — 用户管理
- `/api/v1/test-records` — 心理测评记录
- `/api/v1/analysis` — 文件分析报告
- `/api/v1/dify/*` — Dify AI 集成（聊天、会话、消息）
- `/api/v1/utils` — 健康检查与工具接口
