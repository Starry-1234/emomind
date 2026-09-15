# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# EmoMind LangGraph 版本 — 开发者指引

## 项目定位

EmoMind 心理测评平台。`emomind-sb`（同级目录，使用 Spring Boot 3.2 + FastAPI/Dify）的 AI 能力整体迁移到 **LangGraph + Python 边车** 的版本。
本仓库与 `emomind-sb` **互不依赖**：本分支不再需要部署 Dify，所有 Dify 相关代码在本仓库中已经被删除/在 M0 阶段删除。

| 维度 | `emomind-sb` | `emomind-lg`（本分支） |
|---|---|---|
| 后端核心 | Spring Boot 3.2 + Java 17 | Spring Boot 3.2 + Java 17（沿用） |
| AI 编排 | Dify（外部服务，REST/SSE 代理） | LangGraph（Python 边车，原生事件） |
| 多模态 | Dify 插件 | 自建 Qwen3-Omni + MinMax 调用 |
| 会话存储 | Dify 内部 DB | PostgresSaver + pgvector + Redis |
| SSE 协议 | Dify 私有事件 | LangGraph 原生事件 |
| 前端聊天 | Dify SSE 解析（1400 行 useChat） | `langgraphApi.sendChatStream` 单 SSE 状态机 |

> ⚠️ **不要参考 `emomind-sb/` 的 Dify 相关代码**。Dify 调用代码会在 M0 阶段从本仓库删除；如需了解历史实现，看 `doc/langgraph-migration/06-dify-node-mapping.md`。

## 📌 文档入口（这是新会话的第一站）

完整设计文档与规格在 [`doc/langgraph-migration/`](doc/langgraph-migration/)。新会话开始前 **先读 `doc/langgraph-migration/README.md`** 的"未来会话使用指南"一节，按当前任务定位到对应子模块文档。

| 你接下来要做的事 | 先读哪个文档 |
|---|---|
| 接手 ai-runtime（Python 边车） | [`09-ai-runtime.md`](doc/langgraph-migration/09-ai-runtime.md) |
| 接手 Spring `ConversationMeta` / `AiController` | [`11-conversation-meta.md`](doc/langgraph-migration/11-conversation-meta.md) + [`02-components.md`](doc/langgraph-migration/02-components.md) |
| 接手前端 `useChat.ts` / `langgraphApi.ts` 重写 | [`08-frontend-migration.md`](doc/langgraph-migration/08-frontend-migration.md) |
| 接手部署 / Compose / Dockerfile | [`12-deployment.md`](doc/langgraph-migration/12-deployment.md) |
| 接手 Prompt 工程 | [`07-prompts.md`](doc/langgraph-migration/07-prompts.md) |
| 接手记忆（pgvector / PostgresSaver / Redis） | [`10-memory.md`](doc/langgraph-migration/10-memory.md) |
| 把 Dify YAML 节点映射到 LangGraph 节点 | [`06-dify-node-mapping.md`](doc/langgraph-migration/06-dify-node-mapping.md) |
| 调试 SSE 流 / 暂停续传 / 重新生成 | [`03-data-flow.md`](doc/langgraph-migration/03-data-flow.md) + [`04-error-handling.md`](doc/langgraph-migration/04-error-handling.md) |
| 接手 Redis 取消 / 重新生成多版本 / `workflow_event` | [`plans/2026-07-16-emomind-lg-milestone-5-frontend-rewrite.md`](doc/langgraph-migration/plans/2026-07-16-emomind-lg-milestone-5-frontend-rewrite.md) |

> 📋 当前里程碑实施计划在 `doc/langgraph-migration/plans/`。已完成的 plan：M0–M5。M6（切流量 + 收尾）尚未编写 plan。

## 技术栈

- **后端**：Spring Boot 3.2.5 + Java 17 + Maven + Spring Data JPA + Spring Security + Flyway + PostgreSQL 17 + pgvector 0.7+
- **Python 边车**：FastAPI 0.115 + LangGraph 0.2.x + LangChain 0.3.x + Pydantic 2.x + asyncpg + redis-py + tenacity（包管理用 `uv`）
- **前端**：React 19 + TypeScript + Vite + TanStack Router/Query + Tailwind CSS 4 + shadcn/ui + Biome（lint read-only，自 T7 起）
- **基础设施**：Docker Compose + Traefik + Redis 7 + Mailcatcher + **已移除 Dify**
- **AI 提供商**：MinMax（文本）/ Qwen3-Omni（多模态）/ text-embedding-v3（M3 起，向量记忆）
- **测试**：JUnit 5 + Mockito（Java）/ pytest + httpx + asyncio（ai-runtime）/ Playwright（前端 E2E）

## 顶层架构（一图速记）

```
React Frontend  (frontend/, TanStack Router)
    │  HTTPS + SSE
    ▼
Spring Boot Gateway (backend-sb/)          ← 鉴权 + 聚合（JwtAuthenticationFilter 沿用）
    │  WebClient + X-Internal-Token
    ▼
ai-runtime (Python FastAPI + LangGraph)    ← 仅内网
    │              │              │
    ▼              ▼              ▼
PostgreSQL 17 + pgvector     Redis 7
 (langgraph_checkpoints,     (cancel flags,
  user_memory,               热数据缓存)
  conversation_meta)
```

详细架构、约束、目录结构：[`01-architecture.md`](doc/langgraph-migration/01-architecture.md)。

## 仓库当前状态（截至 2026-07-18，tag `m5-frontend-rewrite`）

M0–M5 全部 ✅ 完成。**M6（切流量 + 收尾）尚未开始**，无 M6 plan 文件。

| Tag | 里程碑 | 内容 |
|---|---|---|
| `m0-foundation` | M0 项目骨架 | backend-sb 去 Dify；ai-runtime FastAPI 空壳；compose 含 redis + pgvector；V4 Flyway |
| `m1-ai-doctor-text` | M1 ai_doctor 文本 | `ai_doctor` graph；`/user/ai-doctor` 切到 `langgraphApi` |
| `m2-ai-doctor-multimodal` | M2 多模态 | Qwen3-Omni 集成；文件附件全链路（image/audio/video/doc） |
| `m3-psych-test` | M3 psych_test | 引导 + Q&A + 评分 + 报告 + TestRecord 回写；text-embedding-v3 |
| `m4-persistence` | M4 持久化 | PostgresSaver + pgvector + `ConversationMeta`；V5 Flyway |
| `m5-frontend-rewrite` | M5 高级交互 | `difyApi` 删除；`useChat.ts` 单 SSE 状态机；Redis cancel + regenerate-versions + chat history UI；`workflow_event` 解决 M3 streaming gap |

**当前分支**：`emomind-lg`。**主分支**（PR 目标）：`main`。

```
emomind-lg/
├── README.md, README.zh-CN.md, CLAUDE.md
├── .env.example / compose.yml / compose.override.yml
├── scripts/                  dev-start.sh / dev-restart.sh / dev-stop.sh / test.sh / generate-client.sh
├── backend-sb/               Spring Boot 3.2 + Java 17
├── ai-runtime/               FastAPI + LangGraph（Python ≥3.11，uv 管理）
├── frontend/                 React 19 + Vite + Biome
├── doc/
│   ├── requirements.md / outline-design.md / detailed-design.md / tasks/
│   └── langgraph-migration/  13 份规格 + plans/M0..M5
├── archive/                  历史归档
└── docs/                     辅助文档
```

## 端口与开发入口

| 服务 | URL |
|------|-----|
| 前端（Vite dev） | http://localhost:5174 |
| 后端 API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| ai-runtime（开发） | http://localhost:8000（仅内网；不直接暴露给浏览器） |
| Adminer（DB） | http://localhost:8082 |
| Traefik Dashboard | http://localhost:8091 |
| Mailcatcher | http://localhost:10801 |
| PostgreSQL | localhost:5433（启 pgvector 扩展后用作向量库） |
| Redis | localhost:6390（容器内 6379） |

> ai-runtime 生产不暴露；Traefik 不配置它的路由规则。详见 [`12-deployment.md`](doc/langgraph-migration/12-deployment.md)。

## 常用命令

### 一键启停（开发）

```bash
# 启动（db + mailcatcher + backend + frontend，后两者后台跑，日志到 backend.log / frontend.log）
bash scripts/dev-start.sh

# 重建（重新读 .env + clean package 后端 + 重启前后端）
bash scripts/dev-restart.sh

# 停止一切
bash scripts/dev-stop.sh

# 查看日志
tail -f backend.log    # Spring Boot
tail -f frontend.log   # Vite
```

### 仅启后端 + 数据库（不开前端）

```bash
docker compose up -d db redis          # 仅基础设施
cd backend-sb
set -a && source ../.env && set +a
mvn spring-boot:run
```

### 后端（Spring Boot / Java 17 / Maven）

```bash
# 跑全部测试（脚本会自动确保 pgvector-test 容器在 55432 端口运行）
bash scripts/test.sh

# 跑单个测试类
cd backend-sb && mvn test -Dtest=AiControllerAuthTest

# 跑单个测试方法
cd backend-sb && mvn test -Dtest=AiControllerAuthTest#unauthenticated_chat_returns401

# 编译（不跑测试）
cd backend-sb && mvn -DskipTests package
```

### Python 边车（ai-runtime）

```bash
# 安装依赖
cd ai-runtime && uv sync

# 跑全部测试
cd ai-runtime && uv run pytest -v

# 跑单个测试文件
cd ai-runtime && uv run pytest tests/integration/test_chat_cancel.py -v

# 跑单个测试函数
cd ai-runtime && uv run pytest tests/integration/test_chat_cancel.py::test_chat_cancel_sets_redis_flag -v

# 启动开发服务器
cd ai-runtime && uv run fastapi dev app/main.py

# 集成测试需要的最小环境变量（Redis/Postgres 可用时跳过 fail）
export LANGGRAPH_MINIMAX_API_KEY=test-key
export LANGGRAPH_QWEN_API_KEY=test-key
export LANGGRAPH_EMBEDDING_API_KEY=test-key
export LANGGRAPH_INTERNAL_TOKEN=changeme-internal-token-must-be-32-chars-long
```

### 前端（React 19 / Vite / Biome / Bun）

```bash
# 装依赖（仓库根用 bun workspaces；前端子包在 frontend/）
bun install

# 启动 dev server（端口 5174）
cd frontend && bun run dev

# Lint（Biome 自 M5 T7 起 read-only）
cd frontend && bun run lint

# 类型检查
cd frontend && bunx tsc --noEmit

# 生产构建
cd frontend && bun run build

# 跑全部 Playwright E2E
cd frontend && bun run test

# 跑单个 spec
cd frontend && bunx playwright test tests/chat-streaming.spec.ts

# 重新生成 OpenAPI TS 客户端（修改后端 API 后必跑）
bash scripts/generate-client.sh
```

### Compose

```bash
# 校验 compose 配置（CI 用）
docker compose -f compose.yml -f compose.override.yml config > /dev/null && echo OK

# 单独起 redis + ai-runtime（与已有前后端配合）
docker compose up -d db redis ai-runtime
```

## 关键约束（实施时必须遵守）

1. **Spring Boot 仍然是鉴权网关**。前端请求先过现有 `JwtAuthenticationFilter`；转发到 ai-runtime 前注入 `X-User-Id` / `X-User-Roles` / `X-Internal-Token` / `X-Trace-Id`。ai-runtime 永不直接对外。
2. **会话状态分两层**：业务元数据（Spring `conversation_meta`）+ 图状态（LangGraph `langgraph_checkpoints`），用 `thread_id` 关联。
3. **SSE 三层透传**：`text/event-stream` + `no-cache` + `X-Accel-Buffering: no`。`AiController` 采用 Reactor `Flux<DataBuffer>` + `blockLast` + 手动 flush 模式。
4. **长期记忆异步写入**：`extract_facts` + `write_long_term` 由 `emit_response` 完成后通过 `asyncio.create_task` 触发；不阻塞 SSE 流关闭。
5. **`extract_facts` / `write_long_term` 不在主 graph 边中** — 否则会因 pgvector 抖动让整个 graph 失败。
6. **保留全部前端交互能力**：流式、stop、pause/resume、regenerate 多版本、sessionStorage 缓存、polling、文件附件。即使 SSE 协议换了，行为不能变。
7. **前端 lint（Biome）自 M5 T7 起 read-only** — 修改代码时不要顺手"修"lint 警告；M6+ 才解除。
8. **`difyApi.ts` 已删除（M5 T9）** — 修改前端 chat 代码时直接用 `langgraphApi.sendChatStream` 与 `useChat` 单状态机；不要重建 `difyApi`。

## 子模块地图

### 后端代码（Spring Boot 沿用 + 新增 AI 转发）

| 后端路径 | 来源 | 用途 |
|---|---|---|
| `backend-sb/src/main/java/com/emomind/controller/AiController.java` | 新 | `/api/v1/ai/**` 入口 |
| `backend-sb/src/main/java/com/emomind/service/AiProxyService.java` | 新 | WebClient 转发到 ai-runtime，注入鉴权头 |
| `backend-sb/src/main/java/com/emomind/service/ConversationMetaService.java` | 新 | 会话元数据 JPA（V5） |
| `backend-sb/src/main/java/com/emomind/config/LangGraphProperties.java` | 新（替代 DifyProperties）| 配置类 |
| `backend-sb/src/main/java/com/emomind/entity/ConversationMeta.java` | 新 | V5 Flyway 引入 |
| `backend-sb/src/main/java/com/emomind/entity/UserMemory.java` | 新 | V4 Flyway 引入 |
| `backend-sb/src/main/resources/db/migration/V4__add_user_memory_and_pgvector.sql` | 新 | pgvector 扩展 + `user_memory` 表（HNSW） |
| `backend-sb/src/main/resources/db/migration/V5__conversation_meta.sql` | 新 | `conversation_meta` 表 |
| `AiController` 已包含 `proxyCancel` + `proxyFileList` + ACL（M5 新增） | — | 取消标志 + 文件列表用户隔离 |

### ai-runtime（M1 起填充，M5 完成态）

```
ai-runtime/app/
├── main.py              FastAPI 入口 + lifespan
├── config.py            pydantic Settings (env LANGGRAPH_*)
├── auth.py              X-Internal-Token + X-User-Id 校验
├── streaming.py         LangGraph → SSE 帧
├── llm_retry.py         tenacity 装饰器
├── api/                 chat.py / conversations.py (含 cancel) / files.py
├── graphs/              state.py / ai_doctor.py / psych_test.py / nodes/
├── models/              factory.py / minimax.py / qwen_omni.py / embedding.py / base.py
├── memory/              checkpointer.py (PostgresSaver) / long_term.py (UserMemoryStore) / cache.py (含 Redis cancel helpers)
└── prompts/             ai_doctor/ / psych_test/  （Jinja2 模板，从 Dify YAML 抽取）
```

### 前端（M5 完成态 — `difyApi` 已删除）

| 前端路径 | 用途 |
|---|---|
| `frontend/src/services/langgraphApi.ts` | 单 SSE 状态机入口（`sendChatStream`） |
| `frontend/src/services/cancelApi.ts` | 调 `POST /api/v1/ai/cancel` 走 Redis |
| `frontend/src/services/conversationApi.ts` | V5 `conversation_meta` 列表 + 历史 |
| `frontend/src/services/langgraphTypes.ts` | Graph / 事件类型（含 `workflow_event`） |
| `frontend/src/hooks/useChat.ts` | 单 SSE 状态机（M5 重写，行为兼容旧 useChat） |
| `frontend/src/hooks/useChatHistory.ts` | 历史会话列表 + 切换 |
| `frontend/src/contexts/ConversationContext.tsx` | 全局会话上下文（M5 重写） |
| `frontend/src/client/` | 自动生成，勿手改（修改后端 API 后跑 `bash scripts/generate-client.sh`） |
| ~~`frontend/src/services/difyApi.ts`~~ | ❌ **已删除（M5 T9）** — 不要重建 |

## 测试与里程碑

7 个里程碑（详见 [`05-testing-milestones.md`](doc/langgraph-migration/05-testing-milestones.md) + [`00-overview.md`](doc/langgraph-migration/00-overview.md) 里程碑表）：

| Phase | 交付物 | Plan 文件 | Tag |
|---|---|---|---|
| **M0** 项目骨架 | backend-sb 去 Dify；ai-runtime FastAPI 空壳；compose 含 redis + pgvector；V4 Flyway | `plans/2026-07-01-emomind-lg-milestone-0-foundation.md` | `m0-foundation` ✅ |
| **M1** ai_doctor 文本路径 | ai_doctor graph 文本路径；`/user/ai-doctor` 切到 `langgraphApi` | `plans/2026-07-02-emomind-lg-milestone-1-ai-doctor-text.md` | `m1-ai-doctor-text` ✅ |
| **M2** ai_doctor 多模态 | Qwen3-Omni 集成；文件附件全链路 | `plans/2026-07-04-emomind-lg-milestone-2-ai-doctor-multimodal.md` | `m2-ai-doctor-multimodal` ✅ |
| **M3** psych_test | 引导 + Q&A + 评分 + 报告 + TestRecord 回写 | `plans/2026-07-05-emomind-lg-milestone-3-psych-test.md` | `m3-psych-test` ✅ |
| **M4** 持久化 + 长期记忆 | PostgresSaver + pgvector + ConversationMeta（V5） | `plans/2026-07-15-emomind-lg-milestone-4-persistence.md` | `m4-persistence` ✅ |
| **M5** 高级交互 | `difyApi` 删除；`useChat` 单 SSE 状态机；Redis cancel；`workflow_event` | `plans/2026-07-16-emomind-lg-milestone-5-frontend-rewrite.md` | `m5-frontend-rewrite` ✅ |
| **M6** 切流量 + 收尾 | 监控告警；E2E 全绿；archive 旧迁移规格 | **待写** | — |

**M6 起步动作**：先在 `doc/langgraph-migration/plans/` 写 `2026-MM-DD-emomind-lg-milestone-6-cutover.md`，再用 `superpowers:writing-plans` skill 规划 10 个左右 task。

每个里程碑结束时的标准动作：
1. 跑 `cd backend-sb && mvn test` + `cd ai-runtime && uv run pytest` + `cd frontend && bun run lint`
2. 跑对应 Playwright E2E（参考 `frontend/tests/`）
3. 在 commit message 末尾标 `[M<n> complete]`
4. 写下一里程碑的 plan，再开始
5. tag：`git tag m<n>-<slug>`

## Flyway 迁移

| 版本 | 引入时机 | 内容 |
|---|---|---|
| V1-V3 | 沿用 emomind-sb | init / superuser / reset tokens |
| V4 | M0（Task 12） | pgvector 扩展 + `user_memory` 表（HNSW 索引） |
| V5 | M4 | `conversation_meta` 表 |

迁移文件路径：`backend-sb/src/main/resources/db/migration/V<n>__<description>.sql`。新增表/字段必须新增 `V<n>__.sql`，不要改已应用的脚本。

## 提交与提交信息

- 使用 Conventional Commits：`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:` / `style:`
- 按层加 scope：`feat(ai-runtime):` / `feat(backend):` / `feat(frontend):` / `test(...)` / `chore(m<n>):`
- 文档更新：`docs:` 或 `[doc]` 前缀
- 提交结束前自检：后端 `mvn test` + 前端 `bun run lint` + ai-runtime `uv run pytest`（如已填充）
- 关键里程碑在 commit message 末尾标 `[M<n> complete]`
- **不要 push**。用户手动 push。

## 回退路径

`emomind-sb` 分支与仓库保留作回滚。业务 DB schema 与 `emomind-sb` 兼容（V1-V3 不动），任何里程碑出问题可切回旧分支不影响生产数据。

## 常用 `Superpowers` 入口

- 新会话开启功能模块工作：**先读 `doc/langgraph-migration/README.md` 的"未来会话使用指南"** 定位到子模块文档
- 需要写计划文件 → 用 `superpowers:writing-plans` skill，按 `plans/YYYY-MM-DD-<feature>.md` 命名
- 需要执行计划 → `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`
- 调试 → `superpowers:debugging` / `superpowers:systematic`

## 新会话建议流程

1. 先读本文件，确定当前里程碑（看 `plans/` 目录最新文件 + 最近 git tag）
2. 读 `doc/langgraph-migration/README.md` 的"未来会话使用指南"，按子模块定位
3. 按"你接下来要做的事"表格读对应子模块文档
4. 修改前后：跑测试套件，写回归测试
5. 修改后端接口后 → 重新生成前端 SDK（`bash scripts/generate-client.sh`）
6. 修改设计决策 → 同步更新 `doc/langgraph-migration/` 对应文档
7. 每完成一个里程碑 → 在 `plans/` 写下一里程碑的计划文件，再开始
