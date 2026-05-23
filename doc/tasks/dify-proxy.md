# Dify AI 代理模块任务文档

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
1. [ ] 配置 WebClient（连接池、超时）
2. [ ] 实现 DifyService（WebClient 调用）
3. [ ] 实现 DifyController（REST API）
4. [ ] 实现 SSE 流式代理（StreamingResponseBody）
5. [ ] 实现文件上传代理
6. [ ] 实现对话列表查询代理
7. [ ] 实现消息历史查询代理
8. [ ] 实现对话删除代理
9. [ ] API Key 配置管理（application.yml）
10. [ ] 单元测试

## 验收标准
- [ ] SSE 流式聊天正常响应
- [ ] 文件上传代理正常
- [ ] 对话列表查询正常
- [ ] 消息历史查询正常
- [ ] 对话删除正常
- [ ] API Key 不暴露给前端
- [ ] Dify 服务不可用时返回友好错误

## 相关文档
- 需求文档：doc/requirements.md #3.5
- 详细设计：doc/detailed-design.md #3.5, #5.4
