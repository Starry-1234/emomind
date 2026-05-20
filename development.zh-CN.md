# 开发指南

## 本地环境

### 依赖

- Docker 和 Docker Compose
- Bun（前端，`npm install -g bun`）
- uv（后端，`pip install uv`）

### 启动项目

```bash
docker compose watch
```

启动完整栈，后端和前端代码修改会自动热重载。

普通启动：

```bash
docker compose up -d
```

### 前端

访问 http://localhost:5173

```bash
cd frontend
bun install
bun run dev
```

### 后端

访问 http://localhost:8000，API 文档 http://localhost:8000/docs

```bash
cd backend
uv sync
fastapi dev app/main.py
```

`docker compose up -d` 启动时后端已启用热重载。

### 数据库迁移

修改模型后创建迁移：

```bash
docker compose exec backend bash
alembic revision --autogenerate -m "migration description"
alembic upgrade head
```

### 生成 API 客户端

后端 API 变更后需要重新生成前端客户端：

```bash
bash ./scripts/generate-client.sh
```

### 运行测试

```bash
# 后端测试（在运行中的栈内）
docker compose exec backend bash scripts/tests-start.sh -x

# 前端 E2E 测试
bunx playwright test
bunx playwright test --ui  # UI 模式
```

## 环境变量

所有配置统一在根目录 `.env` 文件中管理（前后端共用）：

```bash
cp .env.example .env
```

主要变量：

- `SECRET_KEY` — JWT 签名密钥，改成随机字符串
- `POSTGRES_PASSWORD` — 数据库密码
- `FIRST_SUPERUSER_PASSWORD` — 初始管理员密码
- `DIFY_API_URL` — Dify API 地址
- `DIFY_AI_DOCTOR_API_KEY` — AI 心理医生 Dify API Key
- `DIFY_TEST_API_KEY` — 心理测评 Dify API Key
- `VITE_API_URL` — 前端连接后端的地址（本地开发用 `http://localhost:8000`）

### Dify 配置说明

本项目通过 Dify AI 平台提供 AI 心理医生和心理测评功能。需要配置以下环境变量：

```env
DIFY_API_URL=http://your-host-ip/v1
DIFY_AI_DOCTOR_API_KEY=your_ai_doctor_api_key
DIFY_TEST_API_KEY=your_test_api_key
```

获取 API Key：在 Dify 平台创建应用后，从应用设置中获取 API Key。

### Windows Docker 部署注意事项

在 Windows + Docker Desktop 环境下，`host.docker.internal` 可能无法正常解析到宿主机。请使用宿主机的真实局域网 IP：

1. 在命令行运行 `ipconfig` 查看你的 IPv4 地址（如 `192.168.1.4`）
2. 将 `.env` 中的 `DIFY_API_URL` 设置为：
   ```env
   DIFY_API_URL=http://192.168.1.4/v1
   ```

确保 Dify 服务绑定到 `0.0.0.0:80`（而非仅 `127.0.0.1`），以便容器可以访问。

### 前端环境变量说明

前端在 `bun run dev` 开发模式下，通过 `vite.config.ts` 中的 `envDir: "../"` 配置，自动读取根目录 `.env` 中的 `VITE_*` 前缀变量。

**不再需要单独维护 `frontend/.env` 文件。**

## 重置数据库

```bash
docker compose down -v
docker compose up -d
docker compose exec backend bash -c "alembic upgrade head && python app/initial_data.py"
```
