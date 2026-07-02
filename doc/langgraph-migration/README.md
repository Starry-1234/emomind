# EmoMind LangGraph 版本文档

本文档目录包含 EmoMind 心理测评平台的完整设计文档，基于 `emomind-sb` 演进，重点描述从 Dify 到 LangGraph 的迁移。

## 文档结构

```
doc/
├── README.md                          ← 本文件
├── requirements.md                    需求规格（沿用 emomind-sb）
├── outline-design.md                  概要设计（沿用 emomind-sb）
├── detailed-design.md                 详细设计（沿用 emomind-sb，待 M0 补充 LangGraph 部分）
├── tasks/                             任务分解（沿用 emomind-sb）
│   ├── auth.md
│   ├── user-management.md
│   ├── analysis-report.md
│   ├── test-record.md
│   ├── admin-stats.md
│   ├── health-check.md
│   ├── database.md
│   ├── security.md
│   ├── openapi.md
│   ├── frontend-cleanup.md
│   ├── deployment.md
│   └── testing.md
│
└── langgraph-migration/               ← 新增：LangGraph 迁移全流程文档
    ├── README.md
    ├── 00-overview.md
    ├── 01-architecture.md
    ├── 02-components.md
    ├── 03-data-flow.md
    ├── 04-error-handling.md
    ├── 05-testing-milestones.md
    ├── 06-dify-node-mapping.md
    ├── 07-prompts.md
    ├── 08-frontend-migration.md
    ├── 09-ai-runtime.md
    ├── 10-memory.md
    ├── 11-conversation-meta.md
    └── 12-deployment.md
```

## 阅读顺序

### 项目入门
1. 根目录 `README.md` — 项目定位、与 emomind-sb 的关系
2. `doc/langgraph-migration/00-overview.md` — 迁移动机、目标、决策
3. `doc/langgraph-migration/01-architecture.md` — 顶层架构

### 实施期间（按 milestone）
- **M0**: [01-architecture.md](01-architecture.md) + [12-deployment.md](12-deployment.md)
- **M1**: [09-ai-runtime.md](09-ai-runtime.md) + [02-components.md](02-components.md)
- **M2**: [06-dify-node-mapping.md](06-dify-node-mapping.md)（看多模态部分）
- **M3**: [06-dify-node-mapping.md](06-dify-node-mapping.md) + [07-prompts.md](07-prompts.md)
- **M4**: [10-memory.md](10-memory.md) + [11-conversation-meta.md](11-conversation-meta.md)
- **M5**: [08-frontend-migration.md](08-frontend-migration.md) + [03-data-flow.md](03-data-flow.md)
- **M6**: [12-deployment.md](12-deployment.md)（灰度切流量章节）

### 排错时
- 数据流问题 → [03-data-flow.md](03-data-flow.md)
- 错误处理 → [04-error-handling.md](04-error-handling.md)
- 部署问题 → [12-deployment.md](12-deployment.md)

## 文档维护

- 所有设计决策变更需同步更新相关文档
- 每次会话进展需在对应任务文档中更新复选框状态
- 新增功能需补充对应的需求、设计和任务文档
- 子模块重大变更需更新对应 `langgraph-migration/*.md` 文档
- 提交文档更新时附 `[doc]` 前缀