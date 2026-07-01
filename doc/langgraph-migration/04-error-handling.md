# 04 · 错误处理与重试

## 1. 错误分类

| 类别 | 触发条件 | 检测位置 | 响应 |
|------|---------|---------|------|
| **认证失败** | JWT 缺失/过期/无效 | Spring `JwtAuthenticationFilter` | 401，前端跳 `/login` |
| **授权失败** | 非 admin 访问 admin 接口 | Spring Security | 403，前端显示"无权访问"|
| **用户输入错误** | 上传文件超限 / mime 不支持 / graph 名非法 | Spring `AiController` 入口校验 | 400 + 明确错误消息 |
| **ai-runtime 不可达** | 网络超时 / 5xx / 进程崩 | Spring `AiProxyService` | 502 SSE 事件，前端提示 + 重试按钮 |
| **ai-runtime 内部错误** | graph 节点异常 | ai-runtime `try/except` | SSE event=error，code=INTERNAL_ERROR |
| **LLM 临时错误** | provider 429 / 5xx / 网络超时 | ai-runtime `tenacity` 重试 | 重试 2 次后 SSE event=error |
| **LLM 持续错误** | 重试用尽 | ai-runtime | SSE event=error，recoverable=false |
| **Checkpoint 读取失败** | Postgres 临时不可用 | ai-runtime | 503，前端提示"服务暂时不可用" |
| **长期记忆写入失败** | pgvector 写入异常 / 连接超时 | ai-runtime fire-and-forget 任务 | 写 dead_letter 表，不影响主流程 |
| **文件不存在** | chat 引用的 file_id 已失效 | ai-runtime | SSE event=error，code=FILE_NOT_FOUND |
| **SSE 中途断开** | 前端 abort / 网络断开 | ai-runtime Redis cancel | 取消 run；checkpoint 保留 |
| **provider 限流** | OpenAI/Qwen 429 | ai-runtime tenacity 重试 | 退避 1s + 3s 后再试 |

## 2. SSE 错误帧标准格式

```
event: error
data: {
  "code": "LLM_TIMEOUT",
  "message": "Provider minimax timed out after 30s",
  "recoverable": true,
  "thread_id": "...",
  "run_id": "..."
}
```

错误码清单（枚举）：

| Code | HTTP 等价 | Recoverable | 含义 |
|------|-----------|-------------|------|
| `INVALID_INPUT` | 400 | false | 入参校验失败 |
| `UNAUTHORIZED` | 401 | false | 未登录 |
| `FORBIDDEN` | 403 | false | 权限不足 |
| `GRAPH_NOT_FOUND` | 404 | false | graph 名不存在 |
| `THREAD_NOT_FOUND` | 404 | false | thread_id 不存在 |
| `FILE_NOT_FOUND` | 404 | false | file_id 不存在 |
| `FILE_TOO_LARGE` | 413 | false | 文件超限 |
| `RUNTIME_UNAVAILABLE` | 502 | true | ai-runtime 不可达 |
| `INTERNAL_ERROR` | 500 | true | graph 内部异常 |
| `LLM_TIMEOUT` | 504 | true | LLM 调用超时 |
| `LLM_RATE_LIMIT` | 429 | true | provider 限流（重试用尽）|
| `CHECKPOINT_ERROR` | 503 | true | checkpointer 异常 |
| `CANCELLED` | — | — | 用户主动取消（不算错误）|

前端收到 `error` 事件时：
- `recoverable=true` → 按钮"重新生成" / "重试"
- `recoverable=false` → 按钮"开始新对话"
- `code=CANCELLED` → 不显示，UI 状态由前端本地管理

## 3. LLM 调用重试策略

```python
# app/llm_retry.py
from tenacity import (
    retry, stop_after_attempt, wait_exponential,
    retry_if_exception_type, before_sleep_log
)
import logging

logger = logging.getLogger(__name__)

RETRYABLE_EXCEPTIONS = (
    openai.APIConnectionError,
    openai.APITimeoutError,
    openai.RateLimitError,
    httpx.ConnectError,
    httpx.ReadTimeout,
)

llm_retry = retry(
    stop=stop_after_attempt(3),  # 首次 + 2 重试
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(RETRYABLE_EXCEPTIONS),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)

def call_llm(model, messages, **kwargs):
    return llm_retry(model.invoke, messages, **kwargs)
```

不重试的异常：
- `openai.BadRequestError`（参数错）
- `openai.AuthenticationError`（key 失效）
- `ValueError`（prompt 渲染失败）
- 任何非网络/限流类异常

## 4. 取消机制详解

### 4.1 前端主动取消

```
[1] useChat.handleStop()
    │  AbortController.abort()
    │  POST /api/v1/ai/chat/stop {thread_id, run_id}
    ▼
[2] Spring AiController.chatStop
    │  AiProxyService.proxyStop
    ▼
[3] ai-runtime /v1/chat/stop
    │  cache.py: redis.setex(f"cancel:{thread_id}", 30, run_id)
    │  → 返回 200
    ▼
[4] graph 节点下次循环检查 Redis
    │  if redis.get(f"cancel:{thread_id}") == run_id:
    │      raise asyncio.CancelledError()
```

### 4.2 ai-runtime 内部超时

```python
# streaming.py
async def stream_graph(graph, input, config, timeout_ms=120000):
    try:
        async with asyncio.timeout(timeout_ms / 1000):
            async for event in graph.astream_events(input, config=config, version="v2"):
                yield format_sse(event)
    except asyncio.TimeoutError:
        yield format_sse_error("LLM_TIMEOUT", "Graph execution timed out", recoverable=True)
```

### 4.3 Checkpoint 处理

| 场景 | checkpoint 行为 |
|------|----------------|
| 正常完成 | 写入最终 state |
| emit_response 之前取消 | 不写最终 state（中间 state 保留以便 debug）|
| emit_response 之后取消 | 已写入，不再回滚 |
| 重新生成（同一 thread_id）| 覆盖上一个最终 state |

## 5. 文件上传失败处理

### 5.1 上传阶段

```python
# api/files.py
ALLOWED_MIMES = {"image/*", "audio/*", "video/*", "application/pdf", "text/plain"}
MAX_SIZE_MB = 50

@router.post("/v1/files/upload")
async def upload_file(file: UploadFile, user_id: str = Depends(auth)):
    if file.size > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, detail={"code": "FILE_TOO_LARGE", ...})
    if not any(file.content_type.startswith(m.replace("*", "")) for m in ALLOWED_MIMES):
        raise HTTPException(400, detail={"code": "INVALID_INPUT", ...})
    
    file_id = str(uuid4())
    path = STORAGE_PATH / user_id / f"{file_id}.{ext}"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    
    return {"file_id": file_id, "url": f"/v1/files/{file_id}", ...}
```

### 5.2 引用阶段（chat 中）

如果 chat 请求里引用了不存在的 file_id：
- ai-runtime 在 `classify_input` 节点前校验
- 失败 → SSE event=error, code=FILE_NOT_FOUND, recoverable=false
- 前端提示"附件已失效，请重新上传"

## 6. SSE 重连机制

### 6.1 页面刷新恢复

```
[1] 用户刷新页面 / 重新打开标签
    ▼
[2] useChat 挂载
    │  从 sessionStorage 读缓存（如果有）
    │  URL 路径 /user/ai-doctor/chat/{thread_id}
    ▼
[3] GET /api/v1/ai/messages?thread_id=...&graph=...
    ▼
[4] Spring → ai-runtime /v1/messages/{thread_id}
    │  反序列化 checkpoint
    │  返回完整消息历史
    ▼
[5] useChat 渲染历史
```

sessionStorage 仅用于"页面刚刷新、流还没结束"的快速恢复；正式数据从后端拉。

### 6.2 网络抖动自动重连

```
[1] SSE reader.read() 抛错
    ▼
[2] useChat 检测到断开
    │  如果 isStreaming=true 且不是用户主动 stop
    │  → 触发自动重连
    ▼
[3] 自动重连：调用 sendChatStream
    │  threadId 复用
    │  input.messages = 当前累积的 messages（包括未完成的 assistant 部分）
    │  signal = 新 AbortController
    ▼
[4] ai-runtime 从 checkpoint 恢复
    │  重新进入 graph（前面节点结果从 checkpoint 取）
    │  继续 emit_response
    ▼
[5] 前端合并流式输出（基于累积内容）
```

### 6.3 多标签页同会话

```
[Tab A] 打开 /user/ai-doctor/chat/{thread_id}
[Tab B] 同时打开同一 URL

[Tab A] 发送消息 → 发起 SSE run#1
[Tab B] 通过 Redis pub/sub 订阅 thread_id 频道

当 run#1 输出时：
  - ai-runtime 同时写 SSE 到 Tab A + 发 pub/sub 消息
  - Tab B 收到 pub/sub → 触发本地 sendChatStream（同 threadId 新 run）
  - Tab B 展示流式输出
```

实现见 [09-ai-runtime.md §6](09-ai-runtime.md)。

## 7. 监控与告警指标

### 7.1 Micrometer 指标（Spring 端）

```yaml
management:
  metrics:
    tags:
      application: emomind-backend
    distribution:
      percentiles-histogram:
        ai.runtime.duration: true
```

自定义指标：
- `ai_runtime_request_duration_seconds{graph, status}` (histogram)
- `ai_runtime_sse_active_streams{graph}` (gauge)
- `ai_runtime_sse_total_chunks{graph, event_type}` (counter)
- `ai_runtime_errors_total{graph, code}` (counter)
- `ai_runtime_stop_total{graph, source}` (counter: user_cancel, timeout, error)
- `ai_llm_token_usage_total{graph, model, type}` (counter: prompt/completion)

### 7.2 Python 指标（prometheus_client）

ai-runtime 暴露 `/metrics`：

- `ai_runtime_graph_duration_seconds{graph, node}` (histogram)
- `ai_runtime_checkpointer_ops_total{op, status}` (counter)
- `ai_runtime_long_term_memory_ops_total{op, status}` (counter)
- `ai_runtime_active_graph_runs` (gauge)
- `ai_runtime_llm_call_duration_seconds{model}` (histogram)
- `ai_runtime_llm_token_usage{model, type}` (counter)

Spring 通过 Prometheus 抓取；统一在 Grafana 看。

### 7.3 告警规则（建议）

| 指标 | 阈值 | 严重性 |
|------|------|--------|
| `ai_runtime_errors_total{code="LLM_TIMEOUT"}` 1h 内 > 50 | warning | LLM provider 异常 |
| `ai_runtime_checkpointer_ops_total{status="error"}` 5min > 10 | critical | Postgres 不可达 |
| `ai_runtime_active_graph_runs` > 100 | warning | 流量激增 |
| `ai_llm_token_usage_total` 1h 内 > budget * 0.1 | info | 成本预警 |
| `ai_runtime_sse_active_streams` 持续 > 50 | info | 关注 |

## 8. 日志规范

### 8.1 trace_id 贯穿

```
[Spring] 生成 trace_id = UUID v4
        MDC.put("trace_id", trace_id)
        → 注入到 X-Trace-Id 请求头
[ai-runtime] 读 X-Trace-Id
             MDC.put("trace_id", trace_id)
             → 所有 Python 日志带 trace_id
[前端] 收到 SSE 事件时，events 字段含 trace_id
       → 控制台日志输出 trace_id 便于排查
```

### 8.2 日志级别

| 场景 | 级别 |
|------|------|
| SSE 收发每个 chunk | DEBUG |
| Graph 节点开始/结束 | INFO |
| LLM 调用开始/结束（含 token 数）| INFO |
| 重试发生 | WARNING |
| 错误（含 stacktrace）| ERROR |
| 用户主动取消 | DEBUG |
| 长期记忆 dead_letter | WARNING |

## 9. 优雅降级

| 故障 | 降级行为 |
|------|---------|
| Redis 不可达 | 跳过缓存；跳过 cancel 机制（仅靠前端 abort）；继续服务 |
| pgvector 不可达 | load_memory 跳过（不注入长期记忆）；write_long_term 写 dead_letter |
| Qwen3-Omni 不可达 | 多模态输入降级为文本（提示用户"暂不支持该文件类型"）|
| MinMax 不可达 | 文本路径报错（不可降级）；提示用户稍后重试 |
| ai-runtime 整体不可达 | Spring 返回 502；前端展示"AI 服务暂时不可用"+ 缓存可读 |
| Postgres 不可达 | Spring 启动失败；fast fail |

降级原则：核心聊天（文本路径）任何时候都可用；增强功能（多模态、长期记忆）可降级。