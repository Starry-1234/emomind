# EmoMind 项目文档

本文档目录包含 EmoMind 心理测评平台的完整设计文档。

## 文档结构

```
doc/
├── README.md                    # 本文档
├── requirements.md              # 需求规格说明书
├── outline-design.md            # 概要设计文档
├── detailed-design.md           # 详细设计文档
└── tasks/                       # 功能任务文档
    ├── auth.md                  # 认证模块
    ├── user-management.md       # 用户管理模块
    ├── analysis-report.md       # 文件分析报告模块
    ├── test-record.md           # 心理测评记录模块
    ├── dify-proxy.md            # Dify AI 代理模块
    ├── admin-stats.md           # 管理员统计模块
    ├── health-check.md          # 健康检查
    ├── database.md              # 数据库设计
    ├── security.md              # 安全设计
    ├── openapi.md               # OpenAPI 文档
    ├── frontend-cleanup.md      # 前端清理
    └── deployment.md            # 部署配置
```

## 文档阅读顺序

1. **requirements.md** — 了解项目功能需求和非功能需求
2. **outline-design.md** — 了解系统整体架构和技术选型
3. **detailed-design.md** — 了解数据库设计、API 设计、类设计等详细内容
4. **tasks/README.md** — 了解开发执行顺序和模块依赖关系（必读）
5. **tasks/*.md** — 了解各功能模块的具体任务分解

## 文档维护

- 所有设计决策变更需同步更新相关文档
- 每次会话进展需在对应任务文档中更新复选框状态
- 新增功能需补充对应的需求、设计和任务文档
