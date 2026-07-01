# Dify AI 代理模块任务文档

> ⚠️ **OBSOLETE — 已被 LangGraph 迁移替代** (2026-07-01)
>
> 本文描述的 Dify 代理实现将在 M0 / M6 阶段从 `backend-sb/` 完全删除。9 个勾选项 (全部 `[x]`) 代表的是 **`emomind-sb` 分支的历史状态**，不是新分支的工作项。
>
> 等价功能已迁移到：
>
> - 入口规格：[`doc/langgraph-migration/README.md`](../langgraph-migration/README.md)
> - 新 Spring 组件 (`AiController` / `AiProxyService` / `LangGraphProperties`)：[`doc/langgraph-migration/02-components.md`](../langgraph-migration/02-components.md)
> - Python 边车（替代 Dify API）：[`doc/langgraph-migration/09-ai-runtime.md`](../langgraph-migration/09-ai-runtime.md)
> - SSE 流式迁移方案：[`doc/langgraph-migration/03-data-flow.md`](../langgraph-migration/03-data-flow.md)
>
> ⚠️ 不要为本文档的任何步骤设置 `[x]`，除非你在为 `emomind-sb` 老分支修 bug。本分支（`emomind-lg`）继续推进文档勾选 = 在文档里留下误导信号。

## 任务概述
- **功能描述**: 代理前端请求到 Dify AI 平台，包括 SSE 流式聊天、文件上传、对话管理
- **涉及模块**: controller, service, config
- **依赖任务**: auth

## 需求要点
- 发送聊天消息：代理到 Dify，返回 SSE 流式响应
- 文件上传：Base64 编码文件上传到 Dify
- 获取对话列表：按用户过滤
- 获取消息历史：按对话 ID 过滤
- 删除对话：按对话 ID 删除
- API Key 由服务端管理，不暴露给前端

## 设计要点
- **关键类**: DifyController, DifyService, WebClientConfig
- **数据流**: Client → DifyController → DifyService → WebClient → Dify AI Platform
- **边界条件**: SSE 流中断处理、API Key 切换、Dify 服务不可用

## 实现步骤
1. [x] 配置 WebClient（连接池、超时）
2. [x] 实现 DifyService（WebClient 调用）
3. [x] 实现 DifyController（REST API）
4. [x] 实现 SSE 流式代理（StreamingResponseBody）
5. [x] 实现文件上传代理
6. [x] 实现对话列表查询代理
7. [x] 实现消息历史查询代理
8. [x] 实现对话删除代理
9. [x] API Key 配置管理（application.yml）
10. [x] 单元测试

## 验收标准
- [x] SSE 流式聊天正常响应
- [x] 文件上传代理正常
- [x] 对话列表查询正常
- [x] 消息历史查询正常
- [x] 对话删除正常
- [x] API Key 不暴露给前端
- [x] Dify 服务不可用时返回友好错误

## 相关文档
- 需求文档：doc/requirements.md #3.5
- 详细设计：doc/detailed-design.md #3.5, #5.4
