# EmoMind LangGraph 版本

> 分支：`emomind-lg` · 基于 `emomind-sb` 平迁 · 完全脱离 Dify

EmoMind 心理测评平台的下一代后端实现。本分支将 `emomind-sb` 中基于 Dify 的 AI 能力（心理咨询聊天 + 心理测评 + 多模态评估）整体替换为 **LangGraph + 自建 Python 边车服务**架构。

## 与 `emomind-sb` 的关系

| | `emomind-sb` | `emomind-lg`（本分支）|
|--|--------------|----------------------|
| 后端核心 | Spring Boot 3.2 + Java 17 | Spring Boot 3.2 + Java 17（保留）|
| AI 编排 | Dify（外部服务，REST/SSE 代理）| LangGraph（Python 边车，原生事件）|
| 多模态 | Dify 插件（Tongyi + MinMax）| 自建 Qwen3-Omni + MinMax 调用 |
| 会话存储 | Dify 内部 DB | PostgresSaver + pgvector + Redis |
| 前端交互 | Dify SSE 事件协议 | LangGraph 原生事件（SSE），前端 useChat 重写 |
| 部署 | Docker Compose（含 Dify 容器）| Docker Compose（含 ai-runtime 容器，**不再依赖 Dify**）|

两个分支**互不依赖**：本分支不再需要部署 Dify。所有 Dify 相关代码、配置、Dockerfile 在本分支中删除。

## 快速入口

- 📋 [迁移总览](doc/langgraph-migration/00-overview.md) — 从哪里开始读
- 🏗️ [架构设计](doc/langgraph-migration/01-architecture.md) — 顶层架构
- 🧩 [组件契约](doc/langgraph-migration/02-components.md) — 每个服务的接口
- 🔄 [数据流](doc/langgraph-migration/03-data-flow.md) — 关键请求链路
- ⚠️ [错误处理](doc/langgraph-migration/04-error-handling.md) — 重试 / 取消 / 降级
- 🧪 [测试与里程碑](doc/langgraph-migration/05-testing-milestones.md) — 验证策略
- 🗺️ [Dify 节点映射](doc/langgraph-migration/06-dify-node-mapping.md) — 老节点 → 新节点对照
- 💬 [Prompt 抽取指南](doc/langgraph-migration/07-prompts.md) — 从 YAML 抽取到 Python

## 子模块规格（每个子模块一个文档）

- [ai-runtime（Python 边车）](doc/langgraph-migration/09-ai-runtime.md)
- [记忆子系统（PostgresSaver + pgvector + Redis）](doc/langgraph-migration/10-memory.md)
- [ConversationMeta（Spring 端元数据）](doc/langgraph-migration/11-conversation-meta.md)
- [前端迁移](doc/langgraph-migration/08-frontend-migration.md)
- [部署（compose / Dockerfile / 环境变量）](doc/langgraph-migration/12-deployment.md)

## 本地开发（占位 — 实施阶段补充）

```bash
# 待 M0 完成
# cp .env.example .env
# docker compose up -d db redis
# cd backend-sb && set -a && source ../.env && set +a && mvn spring-boot:run
# cd ai-runtime && uv run fastapi dev app/main.py
# cd frontend && bun install && bun run dev
```

完整命令将在 M0 里程碑完成后补全。