# 03 · 数据流

## 1. 用户发起新对话（聊天模式，含文件）

### 1.1 文件上传

```
[1] 前端 useChat.handleFileSelect()
    │  用户选择图片
    ▼
[2] POST /api/v1/ai/files/upload (multipart)
    │  Header: Authorization: Bearer <jwt>
    │  Body: file binary
    ▼
[3] Spring AiController.files.upload
    │  SecurityContextHolder 校验已登录
    │  从 JWT 拿 user_id
    ▼
[4] AiProxyService.uploadFile()
    │  校验 mime 白名单 + 大小
    │  生成 file_id = uuid4()
    │  写到 {storage-path}/{user_id}/{file_id}.{ext}
    │  返回 { file_id, url: "/api/v1/ai/files/{file_id}", mime, size }
    ▼
[5] 前端 langgraphApi.uploadFile()
    │  拿到 {file_id, url}
    │  附加到当前 input.files[]
```

### 1.2 聊天发起

```
[1] 用户点击"发送"
    ▼
[2] 前端 useChat.handleSend()
    │  构造 LangGraphMessage[]（user message + 占位 assistant）
    │  创建 AbortController
    │  写入 sessionStorage 缓存
    │  registerStream(userId, "")
    ▼
[3] langgraphApi.sendChatStream("ai-doctor", {messages, files}, callbacks, {signal})
    │  POST /api/v1/ai/chat (Accept: text/event-stream)
    │  Body: {graph: "ai-doctor", thread_id: null, input: {messages, files}}
    ▼
[4] Spring AiController.chat
    │  鉴权（已登录）
    │  设置响应头：text/event-stream + no-cache + X-Accel-Buffering: no
    │  trace_id = UUID
    ▼
[5] AiProxyService.proxyChatStream(userId, roles, "ai-doctor", null, input)
    │  WebClient POST {ai-runtime-url}/v1/chat
    │  注入 X-User-Id / X-User-Roles / X-Internal-Token / X-Trace-Id
    │  body: {graph: "ai-doctor", thread_id: null, user_id, input}
    │  retrieve().bodyToFlux(DataBuffer.class)
    ▼
[6] ai-runtime FastAPI /v1/chat
    │  auth.py: 校验 X-Internal-Token (HMAC 常量时间比较)
    │  auth.py: 读 X-User-Id
    │  生成 run_id = uuid4()
    │  cache.py: SETEX run:{thread_id_or_temp} = {run_id, user_id} TTL=300s
    ▼
[7] ai_doctor graph.astream_events(input, {configurable: {thread_id, user_id}}, version="v2")
    │
    │  ── 节点依次执行 ──
    │
    ├─ load_memory
    │   long_term.UserMemoryStore.search(user_id, query, k=5)
    │   → 拼 system prompt（"以下是用户历史相关背景：..."）
    │   → 不发 SSE 事件（内部节点）
    │
    ├─ classify_input
    │   LLM 调用 MinMax：判断 modality
    │   → state["modality"] = "image" (示例)
    │   → SSE: event=node_start, name=classify_input
    │
    ├─ analyze_audio (假设 modality=audio)
    │   LLM 调用 Qwen3-Omni：流式生成分析
    │   → SSE: event=token, data={delta: "..."}  * N 次
    │
    ├─ finalize
    │   脱敏 + 长度检查
    │   → SSE: event=node_end, name=finalize
    │
    ├─ emit_response
    │   → SSE: event=message_end, data={thread_id, run_id, full_content, files}
    │   → PostgresSaver 自动保存 checkpoint
    │
    ├─ emit_response 完成后：触发 fire-and-forget 任务
    │  asyncio.create_task(extract_and_persist_facts(state, user_id))
    │  → 包含 extract_facts（LLM 抽取）+ write_long_term（pgvector upsert）
    │  → 完全异步；不阻塞 SSE 流关闭
    │
    ▼
[8] ai-runtime SSE 流关闭
    │
    ▼
[9] Spring AiProxyService.proxyChatStream
    │  Flux<DataBuffer>.blockLast()
    │  写 "data: [DONE]\n\n"
    │  close OutputStream
    ▼
[10] 前端 langgraphApi.sendChatStream
     │  reader.read() 返回 done
     │  callbacks.onMessageEnd(thread_id, run_id, full_content, files)
     ▼
[11] useChat.onMessageEnd
     │  从 "" 缓存迁移到 thread_id 缓存
     │  justResolvedRef.current = thread_id
     │  onSessionCreatedRef.current(thread_id)
     │  → 前端路由跳转 /user/ai-doctor/chat/{thread_id}
     ▼
[12] loadConversations()
     │  GET /api/v1/ai/conversations?graph=ai-doctor
     │  → 刷新侧边栏列表
```

## 2. 用户中途停止对话

```
[1] 用户点击"停止"按钮
    ▼
[2] useChat.handleStop()
    │  AbortController.abort()              ← 取消前端 reader
    │  POST /api/v1/ai/chat/stop {thread_id, run_id}
    ▼
[3] Spring AiController.chatStop
    │  → AiProxyService.proxyStop(userId, threadId, runId)
    ▼
[4] ai-runtime /v1/chat/stop
    │  cache.py: SETEX cancel:{thread_id} = run_id TTL=30s
    │  返回 200
    ▼
[5] ai_doctor graph 协程下次循环
    │  Redis 检查 cancel 标志
    │  → 命中 → 抛 asyncio.CancelledError
    ▼
[6] 流关闭，emit_response 未触发
    │  → PostgresSaver 不写最终 checkpoint（中间状态保留）
    ▼
[7] 前端更新 UI
    │  最后一条 assistant 标记 isPaused=true
    │  内容保留为已累积的部分
```

## 3. 用户暂停 + 继续生成

> 这是 emomind-sb 现有的"高级"能力，本分支需保留。

```
[1] handleStop() 暂停（见 §2）
    │  message.isPaused = true
    │  内容 = 已累积文本
    ▼
[2] 用户点击"继续生成"
    ▼
[3] useChat.handleContinue(messageIndex)
    │  找到 isPaused 的 assistant 消息
    │  拿 msg.userQuery
    │  AbortController 新建
    │  消息状态：isStreaming=true, isPaused=false, content=已累积文本
    ▼
[4] langgraphApi.sendChatStream("ai-doctor", {messages: [user_msg, partial_assistant]}, callbacks, {threadId, signal})
    │
    ▼
[5] ai-runtime /v1/chat (thread_id 复用)
    │  PostgresSaver 加载最新 checkpoint
    │  state.messages = [...历史, user_msg, partial_assistant]
    │  graph.astream_events(input, {configurable: {thread_id}})
    │
    │  从 finalize 节点继续（因为 classify_input 之前的节点结果在 checkpoint 里）
    │  重新进入 analyze_text/audio/... 重新生成完整响应
    │  → 但前端需要的是"在已有内容后追加"
    │
    ▼
[6] 处理方案
    │  Option A（简单）：重新生成整段，emit_response 时前端识别 thread_id 已有消息 → 覆盖
    │  Option B（精细）：图状态里加 "resume_from_offset" 字段，analyze_* 节点跳过已生成 token
    │
    │  推荐 Option A — 重新生成整段对体验影响小，实现简单
    ▼
[7] 前端 onMessageEnd
    │  找到对应 isStreaming 的消息
    │  用新内容替换
    │  isStreaming=false
```

## 4. 用户重新生成（多版本）

```
[1] 用户点击"重新生成"
    ▼
[2] useChat.handleRegenerate(messageIndex)
    │  拿 msg.userQuery
    │  AbortController 新建
    │  messagesRef 里该条消息：
    │    versions = [...versions, latestContent]（含旧的）
    │    currentVersion = versions.length - 1
    │    content = ""（清空，重新累积）
    │    isStreaming=true, isPaused=false
    ▼
[3] langgraphApi.sendChatStream("ai-doctor", {messages: [user_msg]}, callbacks, {threadId})
    │
    ▼
[4] ai-runtime /v1/chat
    │  PostgresSaver 加载 checkpoint
    │  graph 重新进入 analyze_* 节点
    │  emit_response → checkpoint 覆盖（同一 thread_id 新 run）
    ▼
[5] 前端 onMessageEnd
    │  message.content = newContent
    │  message.versions = [...versions, newContent]
    │  message.currentVersion = versions.length - 1
    ▼
[6] 用户点击"上一个版本"
    │  handleSwitchVersion(idx, -1)
    │  不发请求，仅本地切换显示
    │  message.content = versions[currentVersion - 1]
```

## 5. 长期记忆写入（异步）

```
[1] emit_response 节点完成
    │  graph 触发 extract_facts 节点
    ▼
[2] asyncio.create_task(extract_and_upsert(state, user_id))
    │  不 await，独立任务
    ▼
[3] extract_facts
    │  最近 N=10 条 messages
    │  LLM 调用 MinMax：抽取结构化事实
    │  返回 [{"fact": "用户提到工作压力大", "category": "stress", "importance": 0.8}, ...]
    ▼
[4] write_long_term
    │  对每个 fact:
    │    embedding = embed(fact.text)  # 用 text-embedding-v3 或类似
    │    INSERT INTO user_memory (user_id, fact_text, embedding, category, importance, source_thread_id, created_at)
    │    ON CONFLICT (user_id, fact_text_hash) DO UPDATE ...
    │  失败 → 写 dead_letter_user_memory 表 + log
```

## 6. 长期记忆读取（新会话开始）

```
[1] ai_doctor graph: load_memory 节点
    │  从 input 拿 user_id
    │  从 messages 拿最新一条 user message
    ▼
[2] query = latest_user_message.content
    │  query_embedding = embed(query)
    ▼
[3] long_term.UserMemoryStore.search(user_id, query_embedding, k=5)
    │  SELECT fact_text, category, importance
    │  FROM user_memory
    │  WHERE user_id = ? AND embedding <=> ? < 0.3
    │  ORDER BY embedding <=> ? ASC
    │  LIMIT 5
    ▼
[4] 拼 system message
    │  "以下是用户历史相关背景：
    │   1. 用户提到工作压力大（stress, importance=0.8, 2025-06-15）
    │   2. 用户偏好简洁直接的回复风格（preference, importance=0.6, 2025-05-20）
    │   ..."
    ▼
[5] 注入到 state.messages 开头
    │  SystemMessage(content=上面的拼装)
```

## 7. 管理员查看任意用户会话

```
[1] Admin 进入 admin 视图
    │  GET /api/v1/ai/conversations?graph=ai-doctor&user_id={targetUserId}
    ▼
[2] Spring AiController.listConversations
    │  SecurityContext: is_superuser=true
    │  → 允许 targetUserId 参数
    ▼
[3] ConversationMetaService.listForAdmin(targetUserId, graph)
    │  SELECT * FROM conversation_meta
    │  WHERE user_id=? AND graph=?
    │  ORDER BY updated_at DESC
    ▼
[4] Admin 点击会话
    │  GET /api/v1/ai/messages?thread_id=...&graph=ai-doctor
    ▼
[5] Spring AiController.listMessages
    │  鉴权 + thread_id 归属校验（admin 可跨用户）
    ▼
[6] AiProxyService.proxyMessages(userId, threadId, graph)
    │  GET {ai-runtime}/v1/messages/{thread_id}
    │  X-User-Id = 当前 admin 的 id（用于审计）
    │  X-Target-User-Id = 实际所有者（ai-runtime 用于权限审计）
    ▼
[7] ai-runtime /v1/messages/{thread_id}
    │  PostgresSaver 加载最新 checkpoint
    │  state.messages 反序列化为 [{role, content, files?}, ...]
    │  返回 JSON
    ▼
[8] 前端渲染（沿用现有 Admin 视图）
```

## 8. 删除会话

```
[1] User/Admin DELETE /api/v1/ai/conversations/{thread_id}
    ▼
[2] Spring AiController.deleteConversation
    │  SecurityContext 校验所有权（admin 可跨用户）
    ▼
[3] ConversationMetaService.delete(userId, threadId)
    │  DELETE FROM conversation_meta WHERE thread_id=? AND (user_id=? OR is_admin)
    │  → 调 AiProxyService.deleteConversation
    ▼
[4] AiProxyService.deleteConversation
    │  DELETE {ai-runtime}/v1/internal/checkpoints/{thread_id}
    │  X-Internal-Token
    ▼
[5] ai-runtime /v1/internal/checkpoints/{thread_id}
    │  PostgresSaver.delete_thread(thread_id)
    │  → 物理删除 langgraph_checkpoints 中该 thread_id 的所有记录
    │  返回 204
```

## 9. 健康检查链路

```
Traefik → GET /api/v1/utils/health-check (Spring)
  ├─→ DB ping
  ├─→ Redis ping
  └─→ GET {ai-runtime}/healthz (Spring → ai-runtime)
        ├─→ DB ping
        └─→ Redis ping

任何一环失败 → health-check 返回 503
```