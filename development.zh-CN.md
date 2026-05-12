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

复制并填写：

```bash
cp .env.example .env        # 根目录 - 后端配置
cp frontend/.env.example frontend/.env
```

`.env` 主要变量：

- `SECRET_KEY` — JWT 签名密钥，改成随机字符串
- `POSTGRES_PASSWORD` — 数据库密码
- `FIRST_SUPERUSER_PASSWORD` — 初始管理员密码
- `VITE_API_URL` — 前端连接后端的地址（本地开发用 http://localhost:8000）

## 重置数据库

```bash
docker compose down -v
docker compose up -d
docker compose exec backend bash -c "alembic upgrade head && python app/initial_data.py"
```
