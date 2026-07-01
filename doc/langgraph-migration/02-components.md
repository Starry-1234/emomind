# 02 · 组件契约

## 1. Spring Boot 侧

### 1.1 `AiController` (`/api/v1/ai/**`)

| 方法 | 路径 | Content-Type | 入参 | 出参 | 鉴权 |
|------|------|--------------|------|------|------|
| POST | `/chat` | `application/json`（响应 `text/event-stream`）| `{graph, thread_id?, input, files?}` | SSE 流 | 已登录 |
| POST | `/chat/stop` | `application/json` | `{thread_id, run_id}` | 200 `{stopped: true}` | 已登录 |
| GET | `/conversations` | — | query: `graph`, `user_id?` | `Conversation[]` | 已登录（admin 可指定 user_id）|
| GET | `/messages` | — | query: `thread_id`, `graph` | `Message[]` | 已登录（owner 或 admin）|
| DELETE | `/conversations/{thread_id}` | — | — | 204 | 已登录（owner 或 admin）|
| POST | `/conversations` | `application/json` | `{thread_id, graph, title?}` | `ConversationMeta` | 已登录 |
| POST | `/files/upload` | `multipart/form-data` | binary | `{file_id, url, mime, size}` | 已登录 |
| GET | `/files/{file_id}` | — | — | binary | 已登录 |
| GET | `/healthz` | — | — | 200 | 公开 |

**SSE 响应头**（`/chat`）：
```
Content-Type: text/event-stream;charset=UTF-8
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**SSE 事件帧**（由 ai-runtime 生成，Spring 透传）：
```
event: node_start
data: {"name": "analyze_text", "ts": ...}

event: token
data: {"delta": "你好", "thread_id": "...", "run_id": "..."}

event: tool_call
data: {"name": "knowledge_search", "args": {...}}

event: message_end
data: {"thread_id": "...", "run_id": "...", "full_content": "...", "files": [...]}

event: workflow_event
data: {"type": "test_progress", "payload": {"current": 3, "total": 20}}

event: error
data: {"code": "LLM_TIMEOUT", "message": "...", "recoverable": true, "thread_id": "..."}
```

### 1.2 `AiProxyService`

**依赖**：`WebClient`（命名为 `aiRuntimeWebClient`）、`LangGraphProperties`

**方法**：
```java
Flux<SseEvent> proxyChatStream(UUID userId, Set<String> roles, String graph,
                              String threadId, Map<String, Object> input);

Mono<Void> proxyStop(UUID userId, String threadId, String runId);

List<Conversation> listConversations(UUID userId, String graph, UUID targetUserId);
List<Message> listMessages(UUID userId, String threadId, String graph);
Mono<Void> deleteConversation(UUID userId, String threadId);
```

**关键实现细节**：
- 注入头：`X-User-Id`、`X-User-Roles`、`X-Internal-Token`、`X-Trace-Id`
- 连接超时 5s（快速失败），响应超时 120s（流式输出可能慢）
- SSE 透传不解析，原始字节流转发

### 1.3 `ConversationMetaService`

**依赖**：`ConversationMetaRepository`

**方法**：
```java
ConversationMeta create(UUID userId, String graph, String threadId, String title);
List<ConversationMeta> list(UUID userId, String graph);          // 仅自己
List<ConversationMeta> listForAdmin(UUID userId, String graph);  // 管理员代查
Optional<ConversationMeta> find(UUID userId, String threadId);
void updateTitle(UUID userId, String threadId, String title);
void archive(UUID userId, String threadId);
void delete(UUID userId, String threadId);  // 同时调 AiProxyService.deleteConversation
```

**数据权限**：
- 非 admin 只能看/改自己的 `ConversationMeta`
- admin 可指定 user_id 查询
- `delete` 时校验所有权 + admin override

### 1.4 `LangGraphProperties`

```yaml
app:
  langgraph:
    runtime-url: http://ai-runtime:8000
    internal-token: ${LANGGRAPH_INTERNAL_TOKEN:changeme}
    request-timeout-ms: 120000
    connect-timeout-ms: 5000
    model:
      text: minimax
      multimodal: qwen3-omni
    storage:
      backend-path: ${LANGGRAPH_STORAGE_PATH:/var/lib/emomind/files}
      max-file-size-mb: 50
```

详见 [11-conversation-meta.md](11-conversation-meta.md) 和 [12-deployment.md](12-deployment.md)。

---

## 2. ai-runtime（Python 边车）

### 2.1 API 表面

| 路径 | 方法 | 说明 |
|------|------|------|
| `/v1/chat` | POST | 主入口，SSE 流式 |
| `/v1/chat/stop` | POST | 取消进行中的 run |
| `/v1/conversations/{thread_id}` | GET | thread 元数据 + 最后 checkpoint 时间 |
| `/v1/messages/{thread_id}` | GET | 反序列化 checkpoint 为 messages |
| `/v1/conversations/{thread_id}` | DELETE | 删 checkpoint + 元数据 |
| `/v1/files/upload` | POST | multipart，存本地 |
| `/v1/files/{file_id}` | GET | 二进制下载（给多模态 LLM 拉取）|
| `/v1/internal/checkpoints/{thread_id}` | DELETE | **仅内网** — 给 Spring 调，物理删 checkpoint |
| `/healthz` | GET | 存活检查 |

所有 `/v1/*` 端点要求 `X-Internal-Token` 请求头。

### 2.2 模块清单

```
app/
├── main.py                  FastAPI 入口 + lifespan
├── api/
│   ├── deps.py              共享依赖（auth、db session）
│   ├── chat.py              /v1/chat (SSE)
│   ├── chat_stop.py         /v1/chat/stop
│   ├── conversations.py     /v1/conversations/*
│   ├── messages.py          /v1/messages/*
│   └── files.py             /v1/files/*
├── graphs/
│   ├── state.py             GraphState TypedDict
│   ├── ai_doctor.py         build_ai_doctor_graph()
│   ├── psych_test.py        build_psych_test_graph()
│   └── nodes/
│       ├── classify_input.py
│       ├── analyze_text.py
│       ├── analyze_audio.py
│       ├── analyze_video.py
│       ├── extract_doc.py
│       ├── analyze_doc.py
│       ├── fusion_analyze.py
│       ├── finalize.py
│       ├── emit_response.py
│       ├── extract_facts.py
│       ├── write_long_term.py
│       ├── load_memory.py
│       ├── intent_classifier.py
│       ├── guide_assistant.py
│       ├── generate_question.py
│       ├── analyze_answer.py
│       ├── update_progress.py
│       ├── route_after_answer.py
│       ├── generate_report.py
│       └── persist_test_record.py
├── models/
│   ├── factory.py           get_chat_model(provider: str) -> BaseChatModel
│   ├── minimax.py           MinMax provider (langchain ChatModel 适配)
│   ├── qwen_omni.py         Qwen3-Omni provider
│   └── base.py              抽象基类
├── memory/
│   ├── checkpointer.py      get_checkpointer() -> PostgresSaver 单例
│   ├── long_term.py         UserMemoryStore class
│   └── cache.py             get_redis() + 辅助函数
├── prompts/
│   ├── ai_doctor/
│   │   ├── system_prompt.j2
│   │   ├── classify_input.j2
│   │   ├── analyze_text.j2
│   │   ├── analyze_audio.j2
│   │   ├── analyze_video.j2
│   │   ├── analyze_doc.j2
│   │   ├── fusion_analyze.j2
│   │   ├── extract_facts.j2
│   │   └── ...
│   └── psych_test/
│       ├── system_prompt.j2
│       ├── intent_classifier.j2
│       ├── guide_assistant.j2
│       ├── generate_question.j2
│       ├── analyze_answer.j2
│       ├── generate_report.j2
│       └── ...
├── streaming.py             graph.astream_events → SSE 帧
├── auth.py                  X-Internal-Token + X-User-Id 校验
├── config.py                pydantic Settings
└── llm_retry.py             tenacity 装饰器
```

### 2.3 ChatModel 抽象

```python
# app/models/base.py
from abc import ABC, abstractmethod
from langchain_core.language_models import BaseChatModel

class ChatModelProvider(ABC):
    @abstractmethod
    def get(self) -> BaseChatModel: ...

# app/models/factory.py
def get_chat_model(provider: str) -> BaseChatModel:
    if provider == "minimax":
        return MinMaxProvider().get()
    elif provider == "qwen3-omni":
        return QwenOmniProvider().get()
    else:
        raise ValueError(f"Unknown provider: {provider}")
```

每个 provider 内部封装 API key、base_url、timeout、retry 配置。

### 2.4 GraphState

```python
# app/graphs/state.py
from typing import Annotated, Literal, Optional
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage
from typing_extensions import TypedDict

class GraphState(TypedDict):
    # 标准消息累加
    messages: Annotated[list[BaseMessage], add_messages]

    # ai_doctor 专用
    modality: Optional[Literal["text", "audio", "video", "image", "doc", "multimodal"]]
    analysis_result: Optional[dict]    # 各模态分析的中间结果

    # psych_test 专用
    phase: Optional[Literal["guide", "testing", "reporting"]]
    test_progress: Optional[dict]      # {"current": int, "total": int, "scores": [...]}
    emotion_tags: Optional[list[str]]
    pending_question: Optional[dict]   # 当前等待用户回答的题目
    test_record_id: Optional[str]      # 完成后回写的 TestRecord id

    # 通用
    user_id: Optional[str]
    thread_id: Optional[str]
    run_id: Optional[str]
```

### 2.5 Graph 定义

#### `ai_doctor` graph

```python
# app/graphs/ai_doctor.py
from langgraph.graph import StateGraph, START, END
from app.graphs.state import GraphState
from app.graphs.nodes import (
    classify_input, analyze_text, analyze_audio, analyze_video,
    extract_doc, analyze_doc, fusion_analyze, finalize,
    emit_response, extract_facts, write_long_term, load_memory,
)

def build_ai_doctor_graph():
    g = StateGraph(GraphState)

    # 节点注册
    g.add_node("load_memory", load_memory)
    g.add_node("classify_input", classify_input)
    g.add_node("analyze_text", analyze_text)
    g.add_node("analyze_audio", analyze_audio)
    g.add_node("analyze_video", analyze_video)
    g.add_node("extract_doc", extract_doc)
    g.add_node("analyze_doc", analyze_doc)
    g.add_node("fusion_analyze", fusion_analyze)
    g.add_node("finalize", finalize)
    g.add_node("emit_response", emit_response)
    g.add_node("extract_facts", extract_facts)
    g.add_node("write_long_term", write_long_term)

    # 边
    g.add_edge(START, "load_memory")
    g.add_edge("load_memory", "classify_input")
    g.add_conditional_edges(
        "classify_input",
        route_by_modality,
        {
            "text": "analyze_text",
            "audio": "analyze_audio",
            "video": "analyze_video",
            "doc": "extract_doc",
            "multimodal": "fusion_analyze",
        },
    )
    g.add_edge("extract_doc", "analyze_doc")
    g.add_edge("analyze_text", "finalize")
    g.add_edge("analyze_audio", "finalize")
    g.add_edge("analyze_video", "finalize")
    g.add_edge("analyze_doc", "finalize")
    g.add_edge("fusion_analyze", "finalize")
    g.add_edge("finalize", "emit_response")
    # 注：extract_facts / write_long_term 不在主 graph 边中，
    # 由 emit_response 节点完成后通过 asyncio.create_task 触发 fire-and-forget。
    # 这样确保 SSE 流不被长期记忆写入阻塞，也避免 graph 因 pgvector 抖动而失败。
    g.add_edge("emit_response", END)

    return g.compile(checkpointer=get_checkpointer())
```

#### `psych_test` graph（多阶段状态机）

```python
# app/graphs/psych_test.py
def build_psych_test_graph():
    g = StateGraph(GraphState)

    g.add_node("load_test_template", load_test_template)
    g.add_node("load_memory", load_memory)
    g.add_node("intent_classifier", intent_classifier)
    g.add_node("guide_assistant", guide_assistant)
    g.add_node("generate_first_question", generate_first_question)
    g.add_node("generate_next_question", generate_next_question)
    g.add_node("analyze_answer", analyze_answer)
    g.add_node("update_progress", update_progress)
    g.add_node("clarify_answer", clarify_answer)
    g.add_node("generate_report", generate_report)
    g.add_node("persist_test_record", persist_test_record)
    g.add_node("emit_response", emit_response)

    g.add_edge(START, "load_test_template")
    g.add_edge("load_test_template", "load_memory")
    g.add_edge("load_memory", "intent_classifier")

    g.add_conditional_edges(
        "intent_classifier",
        route_by_intent,
        {
            "ask_howto": "guide_assistant",
            "start_test": "generate_first_question",
            "answer": "analyze_answer",
            "chitchat": "guide_assistant",
        },
    )
    g.add_edge("guide_assistant", "emit_response")
    g.add_edge("generate_first_question", "emit_response")
    g.add_edge("emit_response", END)

    g.add_edge("analyze_answer", "update_progress")
    g.add_conditional_edges(
        "update_progress",
        route_after_answer,
        {
            "next_question": "generate_next_question",
            "clarify": "clarify_answer",
            "complete": "generate_report",
        },
    )
    g.add_edge("generate_next_question", "emit_response")
    g.add_edge("clarify_answer", "emit_response")
    g.add_edge("generate_report", "persist_test_record")
    g.add_edge("persist_test_record", "emit_response")

    return g.compile(checkpointer=get_checkpointer())
```

详细 prompt 见 [07-prompts.md](07-prompts.md)；节点实现策略见 [06-dify-node-mapping.md](06-dify-node-mapping.md)。

---

## 3. 前端

### 3.1 `services/langgraphApi.ts`（替代 `difyApi.ts`）

```typescript
export interface LangGraphMessage {
  role: "user" | "assistant"
  content: string
  files?: LangGraphFile[]
  isStreaming?: boolean
  isPaused?: boolean
  userQuery?: string
  versions?: string[]
  currentVersion?: number
  // 元数据
  threadId?: string
  runId?: string
}

export interface StreamCallbacks {
  onToken?: (delta: string) => void
  onNodeStart?: (nodeName: string) => void
  onToolCall?: (name: string, args: Record<string, unknown>) => void
  onMessageEnd?: (threadId: string, runId: string, fullContent: string, files?: LangGraphFile[]) => void
  onWorkflowEvent?: (type: string, payload: unknown) => void
  onError?: (code: string, message: string, recoverable: boolean) => void
}

export async function sendChatStream(
  graph: "ai-doctor" | "psych-test",
  input: { messages: LangGraphMessage[]; files?: LangGraphFile[] },
  callbacks: StreamCallbacks,
  options?: { threadId?: string; signal?: AbortSignal },
): Promise<void>

export async function stopChat(threadId: string, runId: string): Promise<void>
export async function uploadFile(file: File): Promise<LangGraphFile>
export async function getConversations(graph: string): Promise<LangGraphConversation[]>
export async function getMessages(threadId: string, graph: string): Promise<LangGraphMessage[]>
export async function deleteConversation(threadId: string): Promise<void>
```

### 3.2 `useChat.ts`（重写）

**保留**：流式、stop、pause/resume、regenerate with versions、sessionStorage cache、registry、polling、文件附件
**替换**：内部 `sendMessageStream` 调用从 `difyApi` 切到 `langgraphApi`
**新增**：调用 `stopChat` 通知后端取消 run

具体改写策略见 [08-frontend-migration.md](08-frontend-migration.md)。

---

## 4. 子模块规格索引

| 子模块 | 文档 |
|--------|------|
| ai-runtime（Python 边车整体）| [09-ai-runtime.md](09-ai-runtime.md) |
| 记忆（PostgresSaver + pgvector + Redis）| [10-memory.md](10-memory.md) |
| ConversationMeta（Spring 端元数据）| [11-conversation-meta.md](11-conversation-meta.md) |
| 前端迁移细节 | [08-frontend-migration.md](08-frontend-migration.md) |
| 部署 | [12-deployment.md](12-deployment.md) |