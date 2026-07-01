# 01 · 架构设计

## 顶层视图

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Frontend (React 19)                         │
│                  /user/ai-doctor   /user/test                         │
│                  useChat.ts + langgraphApi.ts                         │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ HTTPS + SSE
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│              Spring Boot Gateway (backend-sb/)                       │
│   • JwtAuthenticationFilter (沿用)                                   │
│   • StreakUpdateFilter (沿用)                                        │
│   • AiController (/api/v1/ai/**)  ← 替换原 DifyController           │
│   • AiProxyService    WebClient 转发到 ai-runtime                     │
│   • ConversationMetaService  会话元数据 JPA                          │
│   • 现有 User/TestRecord/FileAnalysisReport 模块 (不动)              │
└────────────┬─────────────────────────────────────┬───────────────────┘
             │ HTTP/SSE (内网)                      │ JPA
             ▼                                      ▼
┌────────────────────────────┐         ┌─────────────────────────────┐
│   ai-runtime (Python)      │         │  PostgreSQL 17 + pgvector   │
│   FastAPI + LangGraph      │         │  • 业务表 (沿用 V1-V3)        │
│   ┌────────────────────┐   │         │  • langgraph_checkpoints    │
│   │ ai_doctor graph    │   │         │  • user_memory (vector)     │
│   │ psych_test graph   │   │         │  • conversation_meta (V5)   │
│   └────────────────────┘   │         └─────────────────────────────┘
│   • ChatModel 抽象          │
│   • PostgresSaver 单例      │         ┌─────────────────────────────┐
│   • pgvector UserMemoryStore│ ◄─────► │       Redis 7               │
│   • Redis 缓存/取消标志     │         │  • 会话热数据缓存            │
└────────────────────────────┘         │  • cancel:{thread_id} 标志  │
                                      └─────────────────────────────┘
```

## 三个核心约束

### 约束 1：Spring Boot 仍是鉴权网关
- 所有前端请求先经过现有 JWT 过滤器（`JwtAuthenticationFilter`）
- 转发到 ai-runtime 前注入 `X-User-Id` / `X-User-Roles` / `X-Internal-Token` / `X-Trace-Id`
- ai-runtime 永远不直接暴露给外网
- 取消鉴权会导致需要重做 CORS、限流、审计 — 得不偿失

### 约束 2：会话状态分两层
- **业务元数据**（会话名、所有者、创建时间）由 Spring `ConversationMetaService` 管，存在 `conversation_meta` 表
- **图状态**（消息历史、phase、score）由 LangGraph `PostgresSaver` 管，存在 `langgraph_checkpoints` 表
- 两层用 `thread_id` 关联

### 约束 3：SSE 必须三层透传
- ai-runtime 生成 LangGraph 原生事件 → Spring `OutputStream` → 前端 `EventSource`
- 每一层都要正确设置 `text/event-stream` + `no-cache` + `X-Accel-Buffering: no`
- 复用现有 `DifyController` 的 Reactor `Flux<DataBuffer>` → `blockLast` + 手动 flush 模式

## 目录结构

```
emomind-lg/                                  ← 新仓库根
├── backend-sb/                              Spring Boot（从 emomind-sb 复制并去 Dify）
│   └── src/main/java/com/emomind/
│       ├── controller/
│       │   └── AiController.java            ← 替换原 DifyController
│       ├── service/
│       │   ├── AiProxyService.java          新
│       │   └── ConversationMetaService.java 新
│       ├── config/
│       │   └── LangGraphProperties.java     新（替换 DifyProperties）
│       ├── entity/
│       │   ├── User.java                    沿用
│       │   ├── TestRecord.java              沿用
│       │   ├── FileAnalysisReport.java      沿用
│       │   ├── PasswordResetToken.java      沿用
│       │   ├── ConversationMeta.java        新（V5 迁移）
│       │   └── UserMemory.java              新（V4 迁移）
│       ├── repository/
│       │   ├── ConversationMetaRepository.java  新
│       │   └── UserMemoryRepository.java       新
│       └── ... （其他沿用）
│
├── ai-runtime/                              Python 边车（新增）
│   ├── app/
│   │   ├── main.py                          FastAPI 启动
│   │   ├── api/
│   │   │   ├── chat.py                      /v1/chat (SSE)
│   │   │   ├── chat_stop.py                 /v1/chat/stop
│   │   │   ├── conversations.py             /v1/conversations/*
│   │   │   ├── messages.py                  /v1/messages/*
│   │   │   └── files.py                     /v1/files/*
│   │   ├── graphs/
│   │   │   ├── ai_doctor.py                 心理咨询 graph
│   │   │   ├── psych_test.py                心理测评 graph
│   │   │   ├── shared.py                    公共节点工厂
│   │   │   └── state.py                     GraphState 类型
│   │   ├── models/
│   │   │   ├── factory.py                   ChatModel 工厂
│   │   │   ├── minimax.py                   MinMax provider
│   │   │   └── qwen_omni.py                 Qwen3-Omni provider
│   │   ├── memory/
│   │   │   ├── checkpointer.py              PostgresSaver 单例
│   │   │   ├── long_term.py                 pgvector UserMemoryStore
│   │   │   └── cache.py                     Redis 客户端
│   │   ├── prompts/                         从 Dify YAML 抽取的 prompt
│   │   │   ├── ai_doctor/
│   │   │   └── psych_test/
│   │   ├── streaming.py                     LangGraph → SSE 帧
│   │   └── auth.py                          X-Internal-Token 校验
│   ├── tests/
│   ├── pyproject.toml                       uv 管理
│   └── Dockerfile
│
├── frontend/                                从 emomind-sb/frontend 复制，去 Dify 化
│   ├── src/services/
│   │   ├── difyApi.ts                       ❌ 删除
│   │   └── langgraphApi.ts                  新
│   ├── src/hooks/
│   │   └── useChat.ts                       重写（保留全部交互能力）
│   └── ...
│
├── compose.yml                              加 ai-runtime + redis 服务
├── compose.override.yml                     开发配置（端口暴露）
├── .env.example                             新增 AI_RUNTIME_URL / MINIMAX_* / QWEN_OMNI_*
├── README.md
└── doc/langgraph-migration/                 本文档目录
```

## 关键依赖版本

| 组件 | 版本 |
|------|------|
| Spring Boot | 3.2.5（沿用）|
| Java | 17（沿用）|
| PostgreSQL | 17（沿用，加 pgvector 扩展）|
| Redis | 7（新增）|
| Python | 3.11 |
| LangGraph | 0.2.x（钉版本）|
| LangChain | 0.3.x |
| FastAPI | 0.115.x |
| Pydantic | 2.x |
| pgvector (psycopg) | 0.3.x |
| redis-py | 5.x |
| tenacity | 9.x |
| React | 19.1（沿用）|

详见 [12-deployment.md](12-deployment.md)。

## 网络与端口

| 服务 | 端口（开发）| 端口（生产 via Traefik）|
|------|------------|----------------------|
| Frontend | 5174 | 5174 |
| Backend API | 8080 | 8080 |
| ai-runtime | 8000（仅内网）| 不暴露 |
| PostgreSQL | 5433 | 5433 |
| Redis | 6379 | 6379 |

ai-runtime 在生产环境**不直接对外**，只通过 Spring Boot 转发。Traefik 不配置 ai-runtime 的路由规则。

## 与原 Dify 集成的删除清单

实施 M6 阶段需要删除的代码/配置：

| 路径 | 处置 |
|------|------|
| `backend-sb/src/main/java/com/emomind/controller/DifyController.java` | 删除 |
| `backend-sb/src/main/java/com/emomind/service/DifyService.java` | 删除 |
| `backend-sb/src/main/java/com/emomind/config/DifyProperties.java` | 删除 |
| `backend-sb/src/main/java/com/emomind/config/WebClientConfig.java` | 删除 `difyWebClient` Bean |
| `application.yml` 中 `app.dify.*` 配置 | 删除 |
| `.env.example` 中 `DIFY_*` 变量 | 删除 |
| `frontend/src/services/difyApi.ts` | 删除 |
| `frontend/src/hooks/useChat.ts` 中 difyApi 引用 | 重写时替换 |
| `dify_workflow/` 目录 | 归档到 `archive/dify_workflow/`（保留 prompt 抽取参考）|
| `README.md` 中 Dify 部署章节 | 替换为 ai-runtime 部署 |
| `compose.yml` 中可能的 dify 服务 | 移除 |