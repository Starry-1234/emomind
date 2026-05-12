# emomind

心理测评平台，支持 AI 聊天、在线测评和心理问答。

## 主要功能

- 用户认证（管理员 / 普通用户）
- AI 心理测评，Dify 平台驱动
- 聊天式心理问答咨询
- 在线答题，动态评分
- AI 自动生成分析报告
- 深色 / 浅色 / 暖色主题

## 技术栈

**后端**: FastAPI + SQLModel + PostgreSQL + JWT

**前端**: React 19 + TypeScript + Vite + TanStack Router + TanStack Query + Tailwind CSS + shadcn/ui

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

- 邮箱: `admin@fastapi`
- 密码: `changethis`

## 开发命令

```bash
# 前端开发
bun run dev

# 后端开发（从 backend/ 目录）
cd backend && fastapi dev app/main.py

# 运行测试
bash ./scripts/test.sh

# 后端接口变更后重新生成前端客户端
bash ./scripts/generate-client.sh
```

## 目录结构

```
backend/app/
  main.py          # FastAPI 应用工厂
  models.py        # SQLModel 模型（User, Item, TestRecord 等）
  crud.py          # 数据库操作
  api/routes/      # API 端点

frontend/src/
  routes/          # 按路由组织的页面组件
  components/      # UI 组件
  hooks/           # 自定义 React hooks
  services/        # API 服务模块
  client/          # 自动生成的 OpenAPI 客户端
```

## 环境配置

敏感配置放在 `.env`（不提交到 Git），参考 `.env.example` 作为模板。

前端环境变量: `frontend/.env`、`frontend/.env.example`
后端环境变量: `.env`
