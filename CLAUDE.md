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

> 📋 当前里程碑实施计划在 `doc/langgraph-migration/plans/`。M0 计划已写好：`plans/2026-07-01-emomind-lg-milestone-0-foundation.md`。

## 技术栈

- **后端**：Spring Boot 3.2.5 + Java 17 + Maven + Spring Data JPA + Spring Security + Flyway + PostgreSQL 17 + pgvector
- **Python 边车（新增）**：FastAPI 0.115 + LangGraph 0.2.x + LangChain 0.3.x + Pydantic 2.x + asyncpg + redis-py + tenacity（包管理用 `uv`）
- **前端**：React 19 + TypeScript + Vite + TanStack Router/Query + Tailwind CSS 4 + shadcn/ui + Biome
- **基础设施**：Docker Compose + Traefik + Redis 7 + Mailcatcher + 移除的 Dify
- **AI 提供商**：MinMax（文本）/ Qwen3-Omni（多模态）；可加 LangSmith 做可观测（可选）
- **测试**：JUnit 5 + Mockito + Testcontainers（pgvector 后端）/ pytest + httpx（ai-runtime）/ Playwright（前端 E2E）

## 顶层架构（一图速记）

```
React Frontend
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

## 仓库当前状态（截至 2026-07-01）

`emomind-lg/` **还没有代码**，只有文档：

```
emomind-lg/
├── README.md                              项目根说明（指向 doc/）
├── CLAUDE.md                              ← 本文件
├── doc/
│   ├── README.md                          文档总入口
│   ├── requirements.md / outline-design.md / detailed-design.md / tasks/  占位（M0 完成后补）
│   └── langgraph-migration/               13 份规格 + plans/
└── （M0 阶段将从 emomind-sb 复制 backend-sb / frontend，删除 Dify，新建 ai-runtime/）
```

实施 M0 时第一步 = `cp -r ../emomind-sb/{backend-sb,frontend,compose.yml,compose.override.yml,.env.example,scripts} ./`。详见 [`plans/2026-07-01-emomind-lg-milestone-0-foundation.md`](doc/langgraph-migration/plans/2026-07-01-emomind-lg-milestone-0-foundation.md) Task 1。

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
| Redis | localhost:6379 |

> ai-runtime 生产不暴露；Traefik 不配置它的路由规则。详见 [`12-deployment.md`](doc/langgraph-migration/12-deployment.md)。

## 常用命令（占位 — M0 完成后补全）

M0 完成后会在此节补充以下内容。当前可参考 `emomind-sb/CLAUDE.md` 的命令清单，但要做以下替换：

- 启动命令增加 `cd ai-runtime && uv run fastapi dev app/main.py`
- 测试 ai-runtime：`cd ai-runtime && uv run pytest`
- 端到端联调：`docker compose up -d db redis ai-runtime` 后再起前后端

完整脚本（`dev-start.sh` / `test.sh`）将在 M0 Task 14 阶段补齐。

## 关键约束（实施时必须遵守）

1. **Spring Boot 仍然是鉴权网关**。前端请求先过现有 `JwtAuthenticationFilter`；转发到 ai-runtime 前注入 `X-User-Id` / `X-User-Roles` / `X-Internal-Token` / `X-Trace-Id`。ai-runtime 永不直接对外。
2. **会话状态分两层**：业务元数据（Spring `conversation_meta`）+ 图状态（LangGraph `langgraph_checkpoints`），用 `thread_id` 关联。
3. **SSE 三层透传**：`text/event-stream` + `no-cache` + `X-Accel-Buffering: no`。复用现有 `DifyController` 的 Reactor `Flux<DataBuffer>` + `blockLast` + 手动 flush 模式。
4. **长期记忆异步写入**：extract_facts + write_long_term 由 emit_response 完成后通过 `asyncio.create_task` 触发；不阻塞 SSE 流关闭。
5. **`extract_facts` / `write_long_term` 不在主 graph 边中** — 否则会因 pgvector 抖动让整个 graph 失败。
6. **保留全部前端交互能力**：流式、stop、pause/resume、regenerate 多版本、sessionStorage 缓存、polling、文件附件。即使 SSE 协议换了，行为不能变。

## 子模块地图

后端代码（M0 完成后将存在）：

| 后端路径 | 来源 | 用途 |
|---|---|---|
| `backend-sb/src/main/java/com/emomind/controller/AiController.java` | 新 | `/api/v1/ai/**` 入口 |
| `backend-sb/src/main/java/com/emomind/service/AiProxyService.java` | 新 | 转发到 ai-runtime |
| `backend-sb/src/main/java/com/emomind/service/ConversationMetaService.java` | 新 | 会话元数据 JPA |
| `backend-sb/src/main/java/com/emomind/config/LangGraphProperties.java` | 新（替代 DifyProperties）| 配置类 |
| `backend-sb/src/main/java/com/emomind/entity/ConversationMeta.java` | 新 | V5 Flyway 迁移引入 |
| `backend-sb/src/main/java/com/emomind/entity/UserMemory.java` | 新 | V4 Flyway 迁移引入 |
| `backend-sb/src/main/resources/db/migration/V4__user_memory.sql` | 新 | pgvector + user_memory 表 |
| `backend-sb/src/main/resources/db/migration/V5__conversation_meta.sql` | 新 | conversation_meta 表 |

ai-runtime（M1 开始填充）：

```
ai-runtime/app/
├── main.py              FastAPI 入口 + lifespan
├── config.py            pydantic Settings (env LANGGRAPH_*)
├── auth.py              X-Internal-Token + X-User-Id 校验
├── streaming.py         LangGraph → SSE 帧
├── llm_retry.py         tenacity 装饰器
├── api/                 chat.py / chat_stop.py / conversations.py / messages.py / files.py
├── graphs/              state.py / ai_doctor.py / psych_test.py / nodes/
├── models/              factory.py / minimax.py / qwen_omni.py / base.py
├── memory/              checkpointer.py (PostgresSaver) / long_term.py (UserMemoryStore) / cache.py
└── prompts/             ai_doctor/ / psych_test/  （Jinja2 模板，从 Dify YAML 抽取）
```

前端（M5 开始填充）：

| 前端路径 | 用途 |
|---|---|
| `frontend/src/services/langgraphApi.ts` | 新，替代 `difyApi.ts` |
| `frontend/src/hooks/useChat.ts` | 重写，行为保留，内部从 difyApi 切到 langgraphApi |
| `frontend/src/services/difyApi.ts` | ❌ 删除（M0 Task 5） |
| `frontend/src/client/` | 自动生成，勿手改（M5 后重新跑 `bun run generate-client`） |

## 测试与里程碑

7 个里程碑（详见 [`05-testing-milestones.md`](doc/langgraph-migration/05-testing-milestones.md) + [`00-overview.md`](doc/langgraph-migration/00-overview.md) 里程碑表）：

| Phase | 交付物 | 计划文件 |
|---|---|---|
| **M0** 项目骨架 | `emomind-lg/` 有代码；backend-sb 去 Dify；ai-runtime 空壳；compose 含 redis | `plans/2026-07-01-emomind-lg-milestone-0-foundation.md` ✅ 已写 |
| **M1** ai_doctor 文本路径 | ai_doctor graph 文本路径；`/user/ai-doctor` 切到 langgraphApi | 待写 |
| **M2** ai_doctor 多模态 | Qwen3-Omni 集成；文件附件全链路 | 待写 |
| **M3** psych_test | 引导 + Q&A + 评分 + 报告 + TestRecord 回写 | 待写 |
| **M4** 持久化 + 长期记忆 | PostgresSaver + pgvector + ConversationMeta | 待写 |
| **M5** 高级交互 | stop / regenerate-versions / 多 tab 同步 | 待写 |
| **M6** 切流量 + 收尾 | 移除 Dify 容器；监控告警；E2E 全绿 | 待写 |

每个里程碑结束时：
1. 跑 `cd backend-sb && mvn test` + `cd ai-runtime && uv run pytest` + `cd frontend && bun run lint`
2. 跑对应 Playwright E2E（参考 `frontend/tests/`）
3. 在 commit message 末尾标 `[M<n> complete]`
4. 写下一里程碑的 plan，再开始

## Flyway 迁移

| 版本 | 引入时机 | 内容 |
|---|---|---|
| V1-V3 | 沿用 emomind-sb | init / superuser / reset tokens |
| V4 | M0（Task 12） | pgvector 扩展 + `user_memory` 表（HNSW 索引） |
| V5 | M4 | `conversation_meta` 表 |

迁移文件路径：`backend-sb/src/main/resources/db/migration/V<n>__<description>.sql`。新增表/字段必须新增 `V<n>__.sql`，不要改已应用的脚本。

## 提交与提交信息

- 使用 Conventional Commits：`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:` / `style:`
- 文档更新：`docs:` 或 `[doc]` 前缀
- 提交结束前自检：后端 `mvn test` + 前端 `bun run lint` + ai-runtime `uv run pytest`（如已填充）
- 关键里程碑在 commit message 末尾标 `[M<n> complete]`

## 回退路径

`emomind-sb` 分支与仓库保留作回滚。业务 DB schema 与 `emomind-sb` 兼容（V1-V3 不动），任何里程碑出问题可切回旧分支不影响生产数据。

## 常用 `Superpowers` 入口

- 新会话开启功能模块工作：**先读 `doc/langgraph-migration/README.md` 的"未来会话使用指南"** 定位到子模块文档
- 需要写计划文件 → 用 `superpowers:writing-plans` skill，按 `plans/YYYY-MM-DD-<feature>.md` 命名
- 需要执行计划 → `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`
- 调试 → `superpowers:debugging` / `superpowers:systematic`

## 新会话建议流程

1. 先读本文件，确定当前里程碑（看 `plans/` 目录最新文件）
2. 读 `doc/langgraph-migration/README.md` 的"未来会话使用指南"，按子模块定位
3. 按"你接下来要做的事"表格读对应子模块文档
4. 修改前后：跑测试套件，写回归测试
5. 修改后端接口后 → 重新生成前端 SDK（`bash ./scripts/generate-client.sh`，M0 完成后可用）
6. 修改设计决策 → 同步更新 `doc/langgraph-migration/` 对应文档
7. 每完成一个里程碑 → 在 `plans/` 写下一里程碑的计划文件，再开始
