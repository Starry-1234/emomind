# 后端

## 技术栈

FastAPI + SQLModel + PostgreSQL + Alembic + JWT

## 启动

```bash
cd backend
uv sync
fastapi dev app/main.py
```

或使用 Docker：

```bash
docker compose up -d backend
```

## 依赖

```bash
uv sync
```

## 数据库迁移

```bash
# 模型变更后创建迁移
alembic revision --autogenerate -m "变更描述"

# 应用迁移
alembic upgrade head
```

## 测试

```bash
bash ./scripts/test.sh
```

## API 路由

位于 `app/api/routes/`：
- `login.py` — 认证
- `users.py` — 用户管理
- `items.py` — 项目管理
- `analysis.py` — 文件分析报告
- `test_records.py` — 心理测评记录
- `utils.py` — 健康检查
- `private.py` — 本地开发专用端点
