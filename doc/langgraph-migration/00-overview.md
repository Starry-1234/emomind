# 00 · 迁移总览

## 背景与动机

`emomind-sb` 分支通过 Dify 平台编排 AI 工作流（心理咨询聊天、心理测评、多模态心理评估）。Dify 提供了开箱即用的可视化编排、SSE 流式、会话持久化、多模态插件，但带来以下痛点：

1. **架构外部依赖**：Dify 作为独立服务运行，部署链路长、跨容器网络配置复杂（Windows 上 `host.docker.internal` 不可靠）。
2. **运维负担**：需要单独维护 Dify 容器、Studio、API Key、数据库；版本升级受 Dify 平台节奏制约。
3. **黑盒编排**：复杂分支（测评的引导→问答→评分→报告）隐藏在 Dify YAML 中，调试只能依赖 Dify Studio；自定义逻辑（如评分规则、记忆检索）写不进节点。
4. **前端耦合**：前端 `useChat.ts`（1400 行）紧密依赖 Dify 私有事件协议，跨会话恢复、多版本切换等逻辑被迫在前端实现。
5. **数据分散**：用户对话历史在 Dify DB，业务数据在 PostgreSQL，关联查询困难；管理员查看他人会话需要绕过业务 DB。

## 目标

将 AI 能力**整体迁移到自建 LangGraph 工作流**，消除 Dify 依赖：

| 维度 | 目标 |
|------|------|
| **功能** | 完全保留现有用户体验：流式聊天、停止、暂停+继续、重新生成多版本、文件附件、会话列表/历史、管理员视角 |
| **架构** | LangGraph 作为 Python 边车服务（ai-runtime），Spring Boot 保留作为鉴权/聚合网关 |
| **可观测** | 所有 AI 调用经过业务服务，trace_id 贯穿，LangSmith 可选接入 |
| **可定制** | 工作流逻辑以 Python 代码形式存在，可单测、可分支、可 A/B |
| **可扩展** | 后续添加新工作流（如抑郁量表评估、儿童心理测评）只需新增 graph + 路由 |

## 范围

### 包含（In Scope）

- 心理咨询聊天（文本 + 多模态输入：图片 / 音频 / 视频 / 文档）
- 心理测评（引导性对话 → 题目问答 → 评分 → 报告）
- 会话持久化（短期 state + 长期记忆）
- 文件上传（图片、音频、视频、文档）
- 会话列表 / 历史加载
- 管理员查看任意用户会话 / 删除会话
- 用户长期记忆（事实抽取、向量检索）

### 不包含（Out of Scope）

- 用户认证（沿用 Spring Boot 现有 JWT 链，不动）
- 用户管理 / 测评记录管理（沿用现有实体和接口）
- Dify Studio 兼容（不保留；本分支移除所有 Dify 相关代码）
- 移动端原生应用（无）
- 多语言 i18n（前端仍仅中文）

## 顶层技术决策

| 决策 | 选择 | 替代方案 | 理由 |
|------|------|---------|------|
| **LangGraph 部署形态** | Python 边车（FastAPI）| LangGraph4j / 前端直连 | LangGraph Python 生态最成熟；Spring Boot 鉴权层不动 |
| **LLM 提供商** | MinMax（文本）+ Qwen3-Omni（多模态）| OpenAI / Claude / 本地 Ollama | 中文能力强、成本可控、与原 Dify 工作流所用模型一致 |
| **迁移策略** | 一次性切换（big-bang）| 灰度并行 / 逐功能迁移 | 启动快、技术债轻；保留旧仓库作回滚 |
| **会话持久化** | PostgresSaver（短期）+ pgvector（长期）+ Redis（缓存）| 仅 Postgres | 短期状态由 checkpointer 兜底；长期记忆用 pgvector 复用现有 PG；Redis 缓解 PG 读压力 |
| **SSE 事件格式** | LangGraph 原生事件 | 保持 Dify 协议 / 自定义 | 完整脱离 Dify，前端 useChat 重写但行为不变 |
| **前端能力保留** | 全特性平迁 | 简化（去掉 pause/resume/versions）| 用户体验零变化是迁移的红线 |

## 迁移里程碑

| Phase | 周期 | 交付物 | 验收 |
|-------|------|--------|------|
| **M0** 项目骨架 | 1 周 | `emomind-lg/` 目录；backend-sb 去 Dify；ai-runtime 空壳；compose 含 redis | `./mvn test` + `pytest` 双绿；compose up 起得来 |
| **M1** ai_doctor 文本路径 | 1 周 | ai-doctor graph 文本路径；前端 `/user/ai-doctor` 切到 langgraphApi | Playwright `chat-streaming` 通过 |
| **M2** ai_doctor 多模态 | 1 周 | Qwen3-Omni 集成；文件附件全链路 | Playwright `chat-file-upload` 通过 |
| **M3** psych_test | 2 周 | 引导 + Q&A + 评分 + 报告全流程 | Playwright `test-complete` 通过；TestRecord 入库 |
| **M4** 持久化 + 长期记忆 | 1 周 | PostgresSaver + pgvector + ConversationMeta | 跨重启 session 可恢复；user_memory 表写入 |
| **M5** 高级交互 | 1 周 | stop / regenerate-versions / 多 tab 同步 | Playwright `chat-regenerate-versions` 通过 |
| **M6** 切流量 + 收尾 | 1 周 | 移除 DifyController/Service；Dify 服务下线；监控告警 | E2E 全绿；Dify 容器不部署 |

单人 ~8 周；两人并行 ~5 周。

## 阅读顺序

1. [01-architecture.md](01-architecture.md) — 顶层架构图与组件边界
2. [02-components.md](02-components.md) — 每个服务的契约
3. [03-data-flow.md](03-data-flow.md) — 关键链路
4. [06-dify-node-mapping.md](06-dify-node-mapping.md) — 老节点 → 新节点对照（实施时查）
5. 按需阅读 04 / 05 / 07 / 08-12

## 风险与回退

| 风险 | 缓解 | 回退 |
|------|------|------|
| Qwen3-Omni 多模态不稳定 | M2 小流量验证；不可用时降级文本 | 切换回 `emomind-sb` 分支 |
| LangGraph 版本 API 变更 | 钉版本 `langgraph==0.2.x`；预留 buffer | — |
| pgvector 性能不足 | 加 hnsw 索引；监控 p95 < 200ms | 切到独立 Qdrant 服务 |
| Spring Boot SSE 转发缓冲 | 复用现有 `X-Accel-Buffering: no` 模式 + Vite proxy 配置 | — |
| LLM provider 限流 | tenacity 重试 2 次；监控 token 用量 | 切换 provider / 申请更高配额 |

**回退路径**：保留 `emomind-sb` 分支与仓库；任何阶段出问题通过切流量回到旧分支，不影响生产数据（业务 DB schema 兼容）。