# 09 · ai-runtime（Python 边车）

## 1. 模块定位

ai-runtime 是 LangGraph 工作流的运行时，承载所有 AI 编排逻辑。它是一个独立的 Python 服务，通过 HTTP / SSE 与 Spring Boot 网关通信。

**职责**
- 接收来自 Spring Boot 的 chat 请求，路由到对应 graph
- 执行 LangGraph 工作流，发出原生 SSE 事件
- 管理 PostgresSaver 短期状态、pgvector 长期记忆、Redis 缓存
- 文件上传/下载（暂存本地）
- 提供内部 API 给 Spring Boot（checkpoint 物理删除、消息反序列化）

**非职责**
- 不做用户认证（信任 Spring 注入的 X-User-Id）
- 不做业务元数据管理（由 Spring ConversationMetaService 负责）
- 不做 quota / 计费（如果有，未来加）
- 不直接面向公网（仅内网）

## 2. 项目骨架

```
ai-runtime/
├── app/
│   ├── __init__.py
│   ├── main.py                  FastAPI 入口 + lifespan
│   ├── config.py                pydantic Settings
│   ├── auth.py                  X-Internal-Token 校验
│   ├── streaming.py             astream_events → SSE 帧
│   ├── llm_retry.py             tenacity 装饰器
│   ├── deps.py                  FastAPI dependencies
│   ├── api/
│   │   ├── __init__.py
│   │   ├── chat.py              /v1/chat
│   │   ├── chat_stop.py         /v1/chat/stop
│   │   ├── conversations.py     /v1/conversations/*
│   │   ├── messages.py          /v1/messages/*
│   │   ├── files.py             /v1/files/*
│   │   └── internal.py          /v1/internal/*（仅 Spring 调）
│   ├── graphs/
│   │   ├── __init__.py
│   │   ├── state.py             GraphState TypedDict
│   │   ├── ai_doctor.py         build_ai_doctor_graph()
│   │   ├── psych_test.py        build_psych_test_graph()
│   │   ├── routes.py            路由函数
│   │   └── nodes/
│   │       ├── __init__.py
│   │       ├── classify_input.py
│   │       ├── analyze_text.py
│   │       ├── analyze_audio.py
│   │       ├── analyze_video.py
│   │       ├── extract_doc.py
│   │       ├── analyze_doc.py
│   │       ├── fusion_analyze.py
│   │       ├── finalize.py
│   │       ├── emit_response.py
│   │       ├── extract_facts.py
│   │       ├── write_long_term.py
│   │       ├── load_memory.py
│   │       ├── intent_classifier.py
│   │       ├── guide_assistant.py
│   │       ├── generate_question.py
│   │       ├── analyze_answer.py
│   │       ├── update_progress.py
│   │       ├── clarify_answer.py
│   │       ├── generate_report.py
│   │       └── persist_test_record.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py              ChatModelProvider 抽象
│   │   ├── factory.py           get_chat_model()
│   │   ├── minimax.py           MinMax provider
│   │   └── qwen_omni.py         Qwen3-Omni provider
│   ├── memory/
│   │   ├── __init__.py
│   │   ├── checkpointer.py      PostgresSaver 单例
│   │   ├── long_term.py         UserMemoryStore
│   │   └── cache.py             Redis client + helpers
│   ├── prompts/
│   │   ├── __init__.py
│   │   ├── loader.py            prompt 加载工具
│   │   ├── ai_doctor/           从 Dify YAML 抽取的 prompts
│   │   └── psych_test/
│   └── observability/
│       ├── __init__.py
│       ├── logging.py           structured logging
│       ├── metrics.py           prometheus_client
│       └── tracing.py           OpenTelemetry（可选）
├── tests/
├── scripts/
│   ├── export_openapi.py
│   └── extract_dify_prompts.py
├── pyproject.toml               uv 管理
├── uv.lock
├── Dockerfile
├── .env.example
└── README.md
```

## 3. 配置

```python
# app/config.py
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LANGGRAPH_", env_file=".env")

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1  # 单 worker 简化 SSE 协调；多 worker 见 §6

    # Security
    internal_token: str = Field(..., min_length=32)

    # PostgreSQL
    database_url: str

    # Redis
    redis_url: str

    # Storage
    storage_path: str = "/var/lib/emomind/files"

    # LLM providers
    minimax_api_key: str
    minimax_base_url: str = "https://api.minimax.chat/v1"
    minimax_text_model: str = "minimax-text-01"

    qwen_omni_api_key: str
    qwen_omni_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    qwen_omni_model: str = "qwen3-omni"

    # Embedding
    embedding_model: str = "text-embedding-v3"
    embedding_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    embedding_api_key: str

    # Limits
    request_timeout_seconds: int = 120
    max_file_size_mb: int = 50
    long_term_memory_top_k: int = 5

    # Observability
    log_level: str = "INFO"
    enable_metrics: bool = True
    metrics_port: int = 9090


settings = Settings()
```

## 4. 入口与生命周期

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.config import settings
from app.memory.checkpointer import init_checkpointer, close_checkpointer
from app.memory.cache import init_redis, close_redis
from app.api import chat, chat_stop, conversations, messages, files, internal
from app.observability.metrics import setup_metrics


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动
    await init_checkpointer()
    await init_redis()
    setup_metrics()
    yield
    # 关闭
    await close_checkpointer()
    await close_redis()


app = FastAPI(
    title="EmoMind AI Runtime",
    version="0.1.0",
    lifespan=lifespan,
)

# 路由
app.include_router(chat.router, prefix="/v1")
app.include_router(chat_stop.router, prefix="/v1")
app.include_router(conversations.router, prefix="/v1")
app.include_router(messages.router, prefix="/v1")
app.include_router(files.router, prefix="/v1")
app.include_router(internal.router, prefix="/v1/internal")


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
```

## 5. auth 校验

```python
# app/auth.py
from fastapi import Header, HTTPException, Depends
from app.config import settings
import hmac


async def verify_internal_token(
    x_internal_token: str = Header(..., alias="X-Internal-Token"),
    x_user_id: str = Header(..., alias="X-User-Id"),
) -> str:
    """
    校验 X-Internal-Token 并返回 X-User-Id。
    必须使用常量时间比较防止时序攻击。
    """
    if not hmac.compare_digest(x_internal_token, settings.internal_token):
        raise HTTPException(401, detail="Invalid internal token")
    return x_user_id


async def verify_user_access(
    x_user_id_target: str = Header(None, alias="X-Target-User-Id"),
    current_user_id: str = Depends(verify_internal_token),
) -> str:
    """
    校验目标用户是否合法。
    普通情况下 X-Target-User-Id 应该等于 X-User-Id；
    管理员场景下 X-User-Id 是 admin 的 id，X-Target-User-Id 是被查的用户。
    """
    return x_user_id_target or current_user_id
```

## 6. SSE 流式输出

```python
# app/streaming.py
import asyncio
import json
import time
from typing import AsyncIterator
from langchain_core.messages import AIMessageChunk
from langgraph.graph import CompiledGraph


def format_sse_event(event_name: str, data: dict) -> str:
    return f"event: {event_name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def stream_graph(
    graph: CompiledGraph,
    input: dict,
    config: dict,
    run_id: str,
) -> AsyncIterator[str]:
    """
    把 graph.astream_events 输出转为标准 SSE 帧。
    """
    accumulated_content = ""
    accumulated_tool_calls = []

    try:
        async with asyncio.timeout(120):
            async for event in graph.astream_events(input, config=config, version="v2"):
                kind = event["event"]
                name = event.get("name", "")
                data = event.get("data", {})

                if kind == "on_chain_start" and name in NODE_NAMES:
                    yield format_sse_event("node_start", {"name": name, "ts": time.time()})

                elif kind == "on_llm_stream":
                    chunk = data.get("chunk")
                    if isinstance(chunk, AIMessageChunk):
                        delta = chunk.content or ""
                        if delta:
                            accumulated_content += delta
                            yield format_sse_event("token", {
                                "delta": delta,
                                "thread_id": config["configurable"].get("thread_id"),
                                "run_id": run_id,
                            })

                elif kind == "on_tool_start":
                    yield format_sse_event("tool_call", {
                        "name": name,
                        "args": data.get("input", {}),
                    })

                elif kind == "on_chain_end" and name == "emit_response":
                    payload = data.get("output", {})
                    yield format_sse_event("message_end", {
                        "thread_id": config["configurable"].get("thread_id"),
                        "run_id": run_id,
                        "full_content": payload.get("final_content", accumulated_content),
                        "files": payload.get("files", []),
                    })

    except asyncio.TimeoutError:
        yield format_sse_event("error", {
            "code": "LLM_TIMEOUT",
            "message": "Graph execution timed out",
            "recoverable": True,
            "thread_id": config["configurable"].get("thread_id"),
            "run_id": run_id,
        })

    except asyncio.CancelledError:
        # 用户主动取消
        pass

    except Exception as e:
        yield format_sse_event("error", {
            "code": "INTERNAL_ERROR",
            "message": str(e),
            "recoverable": True,
            "thread_id": config["configurable"].get("thread_id"),
            "run_id": run_id,
        })
```

## 7. Chat API

```python
# app/api/chat.py
import uuid
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from app.auth import verify_internal_token
from app.graphs.ai_doctor import build_ai_doctor_graph
from app.graphs.psych_test import build_psych_test_graph
from app.streaming import stream_graph
from app.memory.cache import set_cancel_flag, clear_cancel_flag, register_run

router = APIRouter()
_GRAPH_REGISTRY = {
    "ai-doctor": build_ai_doctor_graph,
    "psych-test": build_psych_test_graph,
}


@router.post("/chat")
async def chat(
    body: ChatRequest,
    user_id: str = Depends(verify_internal_token),
):
    thread_id = body.thread_id or f"thread_{uuid.uuid4().hex}"
    run_id = f"run_{uuid.uuid4().hex}"

    graph_builder = _GRAPH_REGISTRY.get(body.graph)
    if not graph_builder:
        raise HTTPException(400, detail={"code": "GRAPH_NOT_FOUND"})

    graph = graph_builder()

    # 注册 run（用于 stop 机制）
    await register_run(thread_id, run_id, user_id, body.graph)
    await clear_cancel_flag(thread_id, run_id)

    config = {
        "configurable": {
            "thread_id": thread_id,
            "user_id": user_id,
            "run_id": run_id,
        }
    }

    async def event_generator():
        async for chunk in stream_graph(graph, body.input, config, run_id):
            yield chunk
        # 流结束清理
        await clear_cancel_flag(thread_id, run_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
```

## 8. Stop API

```python
# app/api/chat_stop.py
from fastapi import APIRouter, Depends
from app.auth import verify_internal_token
from app.memory.cache import set_cancel_flag

router = APIRouter()


@router.post("/chat/stop")
async def stop_chat(
    body: StopRequest,
    user_id: str = Depends(verify_internal_token),
):
    await set_cancel_flag(body.thread_id, body.run_id)
    return {"stopped": True}
```

```python
# app/memory/cache.py (片段)
import redis.asyncio as redis
from app.config import settings

_pool: redis.ConnectionPool | None = None

async def init_redis():
    global _pool
    _pool = redis.ConnectionPool.from_url(settings.redis_url, decode_responses=True)

def get_redis() -> redis.Redis:
    return redis.Redis(connection_pool=_pool)


async def set_cancel_flag(thread_id: str, run_id: str, ttl: int = 30):
    r = get_redis()
    await r.setex(f"cancel:{thread_id}", ttl, run_id)


async def check_cancel_flag(thread_id: str, run_id: str) -> bool:
    r = get_redis()
    flag = await r.get(f"cancel:{thread_id}")
    return flag == run_id


async def clear_cancel_flag(thread_id: str, run_id: str):
    r = get_redis()
    await r.delete(f"cancel:{thread_id}")


async def register_run(thread_id: str, run_id: str, user_id: str, graph: str, ttl: int = 300):
    r = get_redis()
    await r.setex(f"run:{thread_id}", ttl, json.dumps({
        "run_id": run_id, "user_id": user_id, "graph": graph,
    }))


async def get_active_run(thread_id: str) -> dict | None:
    r = get_redis()
    val = await r.get(f"run:{thread_id}")
    return json.loads(val) if val else None
```

## 9. Checkpoint 管理

```python
# app/memory/checkpointer.py
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from app.config import settings

_checkpointer: AsyncPostgresSaver | None = None


async def init_checkpointer():
    global _checkpointer
    _checkpointer = AsyncPostgresSaver.from_conn_string(settings.database_url)
    await _checkpointer.setup()


async def close_checkpointer():
    global _checkpointer
    if _checkpointer:
        await _checkpointer.close()
        _checkpointer = None


def get_checkpointer() -> AsyncPostgresSaver:
    if _checkpointer is None:
        raise RuntimeError("Checkpointer not initialized")
    return _checkpointer
```

## 10. 长期记忆（详见 [10-memory.md](10-memory.md)）

```python
# app/memory/long_term.py
import numpy as np
from app.config import settings
from app.memory.checkpointer import get_checkpointer


class UserMemoryStore:
    def __init__(self, db_pool):
        self._pool = db_pool

    async def upsert(self, user_id: str, fact: str, category: str, importance: float, source_thread_id: str):
        embedding = await self._embed(fact)
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO user_memory (user_id, fact_text, embedding, category, importance, source_thread_id, created_at)
                VALUES ($1, $2, $3::vector, $4, $5, $6, NOW())
                ON CONFLICT (user_id, fact_text_hash) DO UPDATE
                  SET embedding = EXCLUDED.embedding,
                      importance = EXCLUDED.importance,
                      updated_at = NOW()
                """,
                user_id, fact, embedding, category, importance, source_thread_id,
            )

    async def search(self, user_id: str, query: str, k: int = 5) -> list[dict]:
        query_embedding = await self._embed(query)
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT fact_text, category, importance, source_thread_id, created_at,
                       1 - (embedding <=> $1::vector) AS similarity
                FROM user_memory
                WHERE user_id = $2 AND 1 - (embedding <=> $1::vector) > 0.3
                ORDER BY embedding <=> $1::vector ASC
                LIMIT $3
                """,
                query_embedding, user_id, k,
            )
            return [dict(row) for row in rows]

    async def _embed(self, text: str) -> list[float]:
        # 调用 embedding API
        from langchain_openai import OpenAIEmbeddings
        emb = OpenAIEmbeddings(
            model=settings.embedding_model,
            openai_api_key=settings.embedding_api_key,
            openai_api_base=settings.embedding_base_url,
        )
        return await emb.aembed_query(text)
```

## 11. 节点实现约定

每个节点函数签名：

```python
# app/graphs/nodes/analyze_text.py
from typing import TypedDict
from langchain_core.messages import SystemMessage, HumanMessage
from app.graphs.state import GraphState
from app.models.factory import get_chat_model
from app.prompts.loader import render_prompt
from app.llm_retry import call_llm


async def analyze_text(state: GraphState) -> dict:
    """
    纯文本分析节点。
    """
    # 1. 构造 prompt
    messages = state["messages"]
    user_query = messages[-1].content if messages else ""

    system_prompt = render_prompt("ai_doctor", "纯文本分析__system")
    user_prompt = render_prompt(
        "ai_doctor", "纯文本分析__user",
        query=user_query,
        long_term_memory=state.get("long_term_memory", []),
    )

    # 2. 调 LLM（带重试）
    model = get_chat_model("minimax")
    response = await call_llm(
        model,
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ],
    )

    # 3. 返回状态更新（partial）
    return {
        "analyses": {**state.get("analyses", {}), "text": response.content},
    }
```

**约束**：
- 函数签名：`async def node(state: GraphState, config: RunnableConfig | None = None) -> dict`
- 返回值是 state 的部分更新，不是完整 state
- 节点不直接发 SSE（SSE 由 `streaming.py` 在外层处理）
- 节点不直接写 PostgresSaver（LangGraph 编译时自动处理）
- 节点不调 Redis cancel 检查（由 `streaming.py` 的协程外层处理）

## 12. 多 Worker SSE 协调（可选）

如果未来流量上来需要多 worker：

1. `app/main.py` 加 `worker_id = os.environ.get("WORKER_ID", "0")`
2. Redis pub/sub 频道 `stream:{thread_id}`：每个 worker 订阅自己处理的 run
3. `stream_graph()` 内部除了 yield SSE 给本地 client，同时 `await redis.publish(stream_channel, event)`
4. 其他 worker 的同 thread_id 连接收到 pub/sub 后也发起自己的流

实现复杂，建议**先单 worker**。等流量真上来再实现。

## 13. 监控指标

```python
# app/observability/metrics.py
from prometheus_client import Counter, Histogram, Gauge, start_http_server

graph_duration = Histogram(
    "ai_runtime_graph_duration_seconds",
    "Graph execution duration",
    ["graph", "status"],
)

llm_call_duration = Histogram(
    "ai_runtime_llm_call_duration_seconds",
    "LLM call duration",
    ["model", "status"],
)

llm_token_usage = Counter(
    "ai_runtime_llm_token_usage",
    "LLM token usage",
    ["model", "type"],  # type=prompt|completion
)

active_runs = Gauge(
    "ai_runtime_active_graph_runs",
    "Active graph runs",
)

errors_total = Counter(
    "ai_runtime_errors_total",
    "Total errors",
    ["graph", "code"],
)


def setup_metrics():
    if settings.enable_metrics:
        start_http_server(settings.metrics_port)
```

## 14. Dockerfile

```dockerfile
# ai-runtime/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装 uv
RUN pip install uv

# 复制依赖文件
COPY pyproject.toml uv.lock ./

# 安装依赖
RUN uv sync --frozen --no-dev

# 复制代码
COPY app ./app

# 创建存储目录
RUN mkdir -p /var/lib/emomind/files

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/healthz || exit 1

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 15. pyproject.toml

```toml
[project]
name = "emomind-ai-runtime"
version = "0.1.0"
description = "LangGraph-based AI runtime for EmoMind"
requires-python = ">=3.11"

dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "langgraph>=0.2.0",
    "langchain>=0.3.0",
    "langchain-core>=0.3.0",
    "langchain-openai>=0.2.0",
    "langchain-community>=0.3.0",
    "psycopg[binary,pool]>=3.2",
    "pgvector>=0.3",
    "redis>=5.0",
    "tenacity>=9.0",
    "httpx>=0.27",
    "openai>=1.50",
    "unstructured>=0.16",  # 文档提取
    "pypdf>=5.0",
    "python-multipart>=0.0.9",
    "prometheus-client>=0.20",
    "jinja2>=3.1",
    "pyyaml>=6.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "pytest-cov>=5.0",
    "testcontainers[postgres,redis]>=4.7",
    "ruff>=0.5",
    "mypy>=1.10",
    "types-redis",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
markers = [
    "snapshot: LLM snapshot tests (uses real LLM)",
    "uses_real_llm: marker for snapshot tests",
]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "B", "A", "C4", "PT", "RUF"]
ignore = ["E501"]

[tool.mypy]
python_version = "3.11"
strict = true
ignore_missing_imports = true
```

## 16. 已知坑与注意事项

| 问题 | 解决 |
|------|------|
| `langgraph.checkpoint.postgres.aio` 是 async，与同步 graph compile 不兼容 | graph compile 用 sync checkpointer，astream_events 内部自动适配 |
| 多 worker 时 SSE 协调 | 见 §12，先单 worker |
| PostgresSaver.setup() 创建表（首次启动）| 在 lifespan 启动时调 |
| pgvector 扩展需要 CREATE EXTENSION | 在 db init 脚本里加；Flyway V4 也会尝试 |
| Qwen3-Omni 多模态 API 限制 | 单文件大小限制、流式输出不稳定；做好超时和降级 |
| MinMax provider 与 OpenAI SDK 兼容 | 用 langchain-openai 的 ChatOpenAI，base_url 指向 MinMax 端点 |
| SSE 在 Nginx 反代下被缓冲 | Nginx 加 `proxy_buffering off`；详见 [12-deployment.md](12-deployment.md) |
| LLM token 消耗 | 监控 + 限流 + 给用户提供 daily quota（未来）|