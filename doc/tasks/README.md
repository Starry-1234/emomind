# 任务执行顺序

> 本文件定义 `doc/tasks/*.md` 的开发执行顺序和模块间依赖关系。新会话进入开发阶段时，按此顺序推进。

## 依赖拓扑

```
                    ┌──────────────┐
                    │  database    │  ← 所有业务模块的基础
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │   security   │  ← 认证基础设施
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────┴────┐  ┌────┴────┐  ┌────┴────┐
         │  auth   │  │ health  │  │ deploy  │
         └────┬────┘  │ -check  │  │ (并行)  │
              │       └─────────┘  └─────────┘
         ┌────┴────┐
         │ user-   │
         │ manage  │
         └────┬────┘
              │
    ┌─────────┼─────────┬──────────┐
    │         │         │          │
┌───┴───┐ ┌───┴───┐ ┌───┴───┐ ┌──┴────┐
│analysis│ │ test  │ │ dify  │ │ admin │
│-report │ │-record│ │-proxy │ │-stats │
└────────┘ └───────┘ └───────┘ └──┬────┘
                                  │
                         ┌────────┴────────┐
                         │    openapi      │
                         │ frontend-cleanup│
                         └─────────────────┘
```

## 执行顺序

| 序号 | 任务文件 | 说明 | 前置依赖 |
|------|---------|------|---------|
| 1 | `database.md` | JPA 实体、Repository、Flyway 迁移 | 无 |
| 2 | `security.md` | Spring Security 配置、JWT、认证过滤器 | database.md |
| 3 | `auth.md` | 登录、注册、密码重置、Token 验证 | security.md |
| 4 | `user-management.md` | 用户 CRUD、管理员用户管理 | auth.md |
| 5 | `health-check.md` | 健康检查端点 | 无（可并行于 auth） |
| 6 | `analysis-report.md` | 文件分析报告 CRUD | auth.md + database.md |
| 7 | `test-record.md` | 心理测评记录 CRUD | auth.md + database.md |
| 8 | `dify-proxy.md` | Dify AI 代理（SSE 流式） | auth.md |
| 9 | `openapi.md` | OpenAPI 文档生成、前端客户端验证 | 所有 Controller 完成后 |
| 10 | `admin-stats.md` | 管理员仪表盘统计 | user-management + analysis-report + test-record |
| 11 | `openapi.md` | OpenAPI 文档生成、前端客户端验证 | 所有 Controller 完成 |
| 12 | `frontend-cleanup.md` | 前端冗余代码清理 | 后端 API 稳定后 |
| 13 | `deployment.md` | Docker 部署配置调优 | 贯穿全程，最后验证 |
| 14 | `testing.md` | 测试策略与覆盖率 | 所有模块完成后 |
| 15 | `performance.md` | 性能测试与优化 | deployment + testing 完成后 |

## 并行策略

- **database.md + security.md** → 串行，security 依赖 database 的实体
- **auth.md + health-check.md** → 可并行（health-check 不依赖认证）
- **analysis-report.md + test-record.md + dify-proxy.md** → 可并行（都依赖 auth + database）
- **admin-stats.md** → 必须等 user-management + analysis-report + test-record 完成后
- **openapi.md** → 必须等所有 Controller 完成后

## 验收标准

每个任务完成后：
1. 在对应任务文件中勾选已完成的复选框
2. 确保编译通过（`./mvnw compile`）
3. 确保对应测试通过（`./mvnw test -pl <module>` 或整体测试）
4. 提交代码并推送
