# 12 · 部署

## 1. 服务清单

| 服务 | 端口（开发）| 端口（生产 via Traefik）| 镜像 | 资源 |
|------|------------|----------------------|------|------|
| Frontend | 5174 | 5174 | nginx:alpine（自定义） | 256MB |
| Backend API (Spring Boot) | 8080 | 8080 | eclipse-temurin:17-jre-alpine | 1GB |
| ai-runtime (Python) | 8000（仅内网）| 不暴露外网 | python:3.11-slim（自定义） | 1GB |
| PostgreSQL | 5433 | 5433 | pgvector/pgvector:pg17 | 1GB |
| Redis | 6379 | 6379 | redis:7-alpine | 256MB |
| Adminer | 8082 | 不暴露 | adminer:latest | 64MB |
| Traefik | 8091 | 80/443 | traefik:v3.0 | 256MB |
| Mailcatcher | 10801 | 不暴露 | schickling/mailcatcher | 64MB |

**已删除**（vs `emomind-sb`）：
- ❌ Dify 服务（5001 端口 + 多个内部端口）
- ❌ Dify Studio / Dify DB

## 2. compose.yml（生产）

```yaml
# compose.yml
services:
  db:
    image: pgvector/pgvector:pg17
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-emomind}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    labels:
      - "traefik.enable=false"

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    labels:
      - "traefik.enable=false"

  backend:
    build:
      context: .
      dockerfile: backend-sb/Dockerfile
    restart: always
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      ai-runtime:
        condition: service_healthy
    environment:
      POSTGRES_SERVER: db
      POSTGRES_PORT: 5432
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      REDIS_URL: redis://redis:6379
      SECRET_KEY: ${SECRET_KEY}
      FIRST_SUPERUSER: ${FIRST_SUPERUSER}
      FIRST_SUPERUSER_PASSWORD: ${FIRST_SUPERUSER_PASSWORD}
      BACKEND_CORS_ORIGINS: ${BACKEND_CORS_ORIGINS}
      LANGGRAPH_RUNTIME_URL: http://ai-runtime:8000
      LANGGRAPH_INTERNAL_TOKEN: ${LANGGRAPH_INTERNAL_TOKEN}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`${DOMAIN:?error}`) && (PathPrefix(`/api`) || PathPrefix(`/swagger-ui`) || PathPrefix(`/v3/api-docs`))"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=8080"

  ai-runtime:
    build:
      context: .
      dockerfile: ai-runtime/Dockerfile
    restart: always
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      LANGGRAPH_DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      LANGGRAPH_REDIS_URL: redis://redis:6379
      LANGGRAPH_INTERNAL_TOKEN: ${LANGGRAPH_INTERNAL_TOKEN}
      LANGGRAPH_STORAGE_PATH: /var/lib/emomind/files
      LANGGRAPH_MINIMAX_API_KEY: ${MINIMAX_API_KEY}
      LANGGRAPH_MINIMAX_BASE_URL: ${MINIMAX_BASE_URL}
      LANGGRAPH_QWEN_OMNI_API_KEY: ${QWEN_OMNI_API_KEY}
      LANGGRAPH_QWEN_OMNI_BASE_URL: ${QWEN_OMNI_BASE_URL}
      LANGGRAPH_EMBEDDING_API_KEY: ${EMBEDDING_API_KEY:-${QWEN_OMNI_API_KEY}}
      LANGGRAPH_EMBEDDING_BASE_URL: ${EMBEDDING_BASE_URL:-${QWEN_OMNI_BASE_URL}}
      LANGGRAPH_EMBEDDING_MODEL: ${EMBEDDING_MODEL:-text-embedding-v3}
      LANGGRAPH_LOG_LEVEL: ${LOG_LEVEL:-INFO}
    volumes:
      - ai-runtime-files:/var/lib/emomind/files
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    labels:
      - "traefik.enable=false"  # 关键：不暴露给外网

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    restart: always
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`${DOMAIN:?error}`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"

  traefik:
    image: traefik:v3.0
    restart: always
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--accesslog=true"
      - "--log.level=INFO"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt

volumes:
  pgdata:
  redisdata:
  ai-runtime-files:
  letsencrypt:
```

## 3. compose.override.yml（开发）

```yaml
# compose.override.yml
services:
  db:
    ports:
      - "5433:5432"

  redis:
    ports:
      - "6379:6379"

  backend:
    ports:
      - "8080:8080"
    environment:
      SPRING_PROFILES_ACTIVE: dev

  ai-runtime:
    ports:
      - "8000:8000"  # 仅开发时暴露，便于调试

  adminer:
    image: adminer:latest
    restart: always
    ports:
      - "8082:8080"
    environment:
      ADMINER_DEFAULT_SERVER: db
    depends_on:
      - db

  mailcatcher:
    image: schickling/mailcatcher
    restart: always
    ports:
      - "10801:1080"

  traefik:
    image: traefik:v3.0
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--api.insecure=true"
    ports:
      - "8091:8080"  # Dashboard
```

## 4. Dockerfile（Spring Boot 不变）

```dockerfile
# backend-sb/Dockerfile（沿用 emomind-sb）
FROM eclipse-temurin:17-jre-alpine AS builder
WORKDIR /app
RUN apk add --no-cache curl
COPY backend-sb/target/emomind-backend-1.0.0-SNAPSHOT.jar app.jar
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/api/v1/utils/health-check/ || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
```

## 5. Dockerfile（ai-runtime 新增）

见 [09-ai-runtime.md §14](09-ai-runtime.md)。

## 6. 环境变量

```bash
# .env.example

# ============ Database ============
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-db-password
POSTGRES_DB=emomind

# ============ Redis ============
REDIS_URL=redis://localhost:6379

# ============ Security ============
SECRET_KEY=your-random-secret-at-least-32-chars
FIRST_SUPERUSER=admin@example.com
FIRST_SUPERUSER_PASSWORD=your-admin-password
BACKEND_CORS_ORIGINS=http://localhost:5174
LANGGRAPH_INTERNAL_TOKEN=your-internal-token-at-least-32-chars

# ============ LLM Providers ============
MINIMAX_API_KEY=your-minimax-key
MINIMAX_BASE_URL=https://api.minimax.chat/v1

QWEN_OMNI_API_KEY=your-qwen-key
QWEN_OMNI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

EMBEDDING_MODEL=text-embedding-v3
EMBEDDING_API_KEY=your-qwen-key
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# ============ Mail ============
SMTP_HOST=mailcatcher
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_AUTH=false
SMTP_TLS=false
EMAILS_FROM_EMAIL=noreply@example.com

# ============ Traefik / Production ============
DOMAIN=your-domain.com
ACME_EMAIL=admin@your-domain.com

# ============ Logging ============
LOG_LEVEL=INFO
```

## 7. 健康检查链路

Traefik → Frontend（nginx）→ Backend `/api/v1/utils/health-check/` → 校验 DB / Redis / ai-runtime

```java
// backend-sb/src/main/java/com/emomind/controller/UtilsController.java (扩展)
@GetMapping("/health-check/")
public ResponseEntity<Map<String, Object>> healthCheck() {
    Map<String, Object> result = new HashMap<>();
    result.put("status", "ok");
    result.put("db", checkDb());
    result.put("redis", checkRedis());
    result.put("ai_runtime", checkAiRuntime());
    return ResponseEntity.ok(result);
}

private String checkAiRuntime() {
    try {
        String response = webClient.get()
            .uri(langGraphProperties.getRuntimeUrl() + "/healthz")
            .retrieve()
            .bodyToMono(String.class)
            .timeout(Duration.ofSeconds(3))
            .block();
        return "ok";
    } catch (Exception e) {
        return "fail: " + e.getMessage();
    }
}
```

## 8. Nginx 配置（前端）

```nginx
# frontend/nginx.conf
server {
    listen 80;
    server_name _;

    # SSE 必须禁缓冲
    proxy_buffering off;
    proxy_cache off;

    # 静态资源
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 安全头
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header Referrer-Policy strict-origin-when-cross-origin;
}
```

## 9. 本地开发启动顺序

```bash
# 1. 基础设施（DB + Redis + Mailcatcher）
docker compose -f compose.yml -f compose.override.yml up -d db redis mailcatcher

# 2. 后端
cd backend-sb
set -a && source ../.env && set +a
mvn spring-boot:run

# 3. ai-runtime（新开终端）
cd ai-runtime
uv sync
LANGGRAPH_DATABASE_URL=postgresql://postgres:your-db-password@localhost:5433/emomind \
LANGGRAPH_REDIS_URL=redis://localhost:6379 \
LANGGRAPH_INTERNAL_TOKEN=your-internal-token \
LANGGRAPH_MINIMAX_API_KEY=your-key \
LANGGRAPH_QWEN_OMNI_API_KEY=your-key \
uv run uvicorn app.main:app --reload --port 8000

# 4. 前端
cd frontend
bun install
bun run dev
```

## 10. 生产部署流程

```bash
# 1. 构建后端 JAR
cd backend-sb
mvn clean package -DskipTests
cd ..

# 2. 推送代码到 git
git add . && git commit -m "chore: prepare for production" && git push

# 3. 服务器上部署
ssh user@server
cd /opt/emomind
git pull
docker compose -f compose.yml up -d --build

# 4. 验证
curl -f https://your-domain.com/api/v1/utils/health-check/
```

## 11. 灰度切流量（emomind-sb → emomind-lg）

如果要在生产环境从 `emomind-sb` 平滑过渡到 `emomind-lg`：

**策略 A：双部署 + 前端切换**
1. `emomind-sb` 和 `emomind-lg` 同时跑在不同端口/域名
2. 前端通过环境变量 `VITE_API_URL` 切换
3. 灰度：按用户 ID 切（1% → 10% → 100%）
4. 完全切换后下掉 `emomind-sb`

**策略 B：蓝绿部署**
1. 部署 `emomind-lg` 到"绿"环境
2. Traefik 权重：蓝 100% → 90/10 → 50/50 → 0/100
3. 观察错误率
4. 完全切换后下掉"蓝"

**数据迁移**：见 [11-conversation-meta.md §8](11-conversation-meta.md)。

## 12. 监控与告警（生产）

- Prometheus 抓取 Backend `/actuator/prometheus` + ai-runtime `:9090/metrics`
- Grafana 面板：
  - Spring Boot 通用（heap / GC / HTTP / DB）
  - ai-runtime（graph 耗时 / LLM 调用 / checkpoint ops / long term memory）
  - SSE 活跃流数 / 错误率
- AlertManager 规则：
  - ai_runtime_errors_total > 10/min
  - ai_runtime_graph_duration_seconds:p95 > 30s
  - ai_runtime_active_graph_runs > 50
  - spring_backend_http_requests_seconds:p95 > 2s
  - postgres_connections > 80% of max

## 13. 备份策略

| 数据 | 频率 | 保留 | 方式 |
|------|------|------|------|
| PostgreSQL 全量 | 每日 03:00 UTC | 30 天 | `pg_dump` 到 S3 |
| PostgreSQL WAL | 持续 | 7 天 | WAL-G 流式 |
| Redis | 不备份（仅缓存）| — | — |
| ai-runtime 上传文件 | 与 PostgreSQL 同 | 30 天 | 与 PostgreSQL 一起 snapshot |

## 14. 安全加固

- [ ] 所有 API key 走环境变量，**不进 git**
- [ ] `LANGGRAPH_INTERNAL_TOKEN` 至少 32 字符随机
- [ ] ai-runtime 容器**不暴露**外网（compose 中 `traefik.enable=false`）
- [ ] Docker socket 只读挂载给 Traefik
- [ ] PostgreSQL 容器内不暴露端口（生产）
- [ ] HTTPS 强制（Traefik 自动重定向 HTTP → HTTPS）
- [ ] Rate limiting（Traefik 中间件，未来加）

## 15. 已知部署坑

| 问题 | 解决 |
|------|------|
| ai-runtime 启动时 PostgresSaver 第一次 setup 创建表失败 | init script 必须先 `CREATE EXTENSION vector`；pgvector 镜像已包含 |
| Spring → ai-runtime 网络：Docker 内用服务名 `ai-runtime`；本地用 `localhost:8000` | 通过 `LANGGRAPH_RUNTIME_URL` 环境变量切换 |
| Traefik 不识别 ai-runtime | 显式 `traefik.enable=false` |
| 前端 SSE 经 Nginx 反代被缓冲 | `proxy_buffering off`（已配置）|
| 多副本 ai-runtime SSE 协调 | 先单 worker；详见 [09-ai-runtime.md §12](09-ai-runtime.md) |
| pgvector 索引占用内存大 | HNSW `ef_construction=64` 是平衡值；可调到 32 省内存 |
| Spring Boot 启动慢 → ai-runtime 还没好 → health check 失败 | `depends_on: condition: service_healthy` + 启动顺序 |