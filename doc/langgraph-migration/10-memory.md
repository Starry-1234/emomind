# 10 · 记忆子系统（PostgresSaver + pgvector + Redis）

## 1. 三层记忆架构

| 层 | 存储 | 内容 | 生命周期 | 实现 |
|----|------|------|---------|------|
| **短期（会话状态）** | PostgreSQL via LangGraph `PostgresSaver` | 当前 thread 的 state（含 messages、phase、progress 等）| 跟随 thread 存在；可清理 | `langgraph.checkpoint.postgres` |
| **长期（用户事实）** | PostgreSQL + pgvector | 跨 thread 的用户事实、偏好、情绪模式 | 永久，直到显式删除 | 自建 `user_memory` 表 + 向量索引 |
| **缓存（运行时）** | Redis | 会话热数据缓存、cancel 标志、活跃 run 映射 | 短期 TTL | `redis-py` + `redis.asyncio` |

## 2. 短期：PostgresSaver

### 2.1 表结构（LangGraph 自动创建）

`langgraph_checkpoints`（主表）

```sql
CREATE TABLE IF NOT EXISTS langgraph_checkpoints (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    parent_checkpoint_id TEXT,
    type TEXT,
    checkpoint JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

CREATE INDEX IF NOT EXISTS langgraph_checkpoints_thread_id_idx
    ON langgraph_checkpoints (thread_id);
```

`langgraph_checkpoint_blobs`（存储 state 的大字段）

```sql
CREATE TABLE IF NOT EXISTS langgraph_checkpoint_blobs (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL,
    version TEXT NOT NULL,
    type TEXT NOT NULL,
    blob BYTEA,
    PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
);
```

`langgraph_checkpoint_writes`（存储节点写入）

```sql
CREATE TABLE IF NOT EXISTS langgraph_checkpoint_writes (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    channel TEXT NOT NULL,
    type TEXT,
    blob BYTEA NOT NULL,
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);
```

### 2.2 初始化

```python
# app/memory/checkpointer.py
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

_checkpointer: AsyncPostgresSaver | None = None

async def init_checkpointer():
    global _checkpointer
    _checkpointer = AsyncPostgresSaver.from_conn_string(settings.database_url)
    await _checkpointer.setup()  # 自动创建表（首次）
```

### 2.3 用法

```python
# 在 graph compile 时绑定
graph = builder.compile(checkpointer=get_checkpointer())

# 调用时传 thread_id
config = {"configurable": {"thread_id": "thread_abc123"}}
await graph.ainvoke(input, config=config)

# 续聊（同一 thread_id 自动从最近 checkpoint 恢复）
config = {"configurable": {"thread_id": "thread_abc123"}}
await graph.ainvoke(new_input, config=config)
```

### 2.4 清理

删除 thread 的所有 checkpoint：

```python
async def delete_thread_checkpoints(thread_id: str):
    cp = get_checkpointer()
    # LangGraph 0.2.x 的 API
    await cp.adelete_thread(thread_id)
```

### 2.5 测试

```python
# tests/integration/test_checkpoint_resume.py
async def test_resume_after_restart(checkpointer, test_thread_id):
    # 第一次跑
    graph_a = build_ai_doctor_graph()
    await graph_a.ainvoke({"messages": [HumanMessage("第一句")]}, config={"configurable": {"thread_id": test_thread_id}})

    # 模拟重启：新建 graph 实例（同一 checkpointer）
    graph_b = build_ai_doctor_graph()
    state = await graph_b.aget_state(config={"configurable": {"thread_id": test_thread_id}})

    assert state.values["messages"][-1].content == "第一句"
```

## 3. 长期：pgvector

### 3.1 Flyway V4 迁移

```sql
-- backend-sb/src/main/resources/db/migration/V4__add_user_memory_and_pgvector.sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE user_memory (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fact_text TEXT NOT NULL,
    fact_text_hash CHAR(64) NOT NULL,  -- SHA-256，用于去重
    embedding vector(1024) NOT NULL,   -- Qwen text-embedding-v3 维度
    category VARCHAR(50) NOT NULL,     -- 'preference' / 'fact' / 'emotion' / 'concern'
    importance REAL NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    source_thread_id TEXT,             -- 来自哪个 thread（可空）
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, fact_text_hash)
);

-- HNSW 索引（推荐用于向量召回）
CREATE INDEX user_memory_embedding_hnsw_idx
    ON user_memory
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 按用户和时间过滤的辅助索引
CREATE INDEX user_memory_user_id_created_at_idx
    ON user_memory (user_id, created_at DESC);

-- Dead letter（写入失败的事实）
CREATE TABLE user_memory_dead_letter (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    fact_text TEXT NOT NULL,
    category VARCHAR(50),
    error TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.2 向量维度

`text-embedding-v3`（Qwen）输出 1024 维。如果换 embedding 模型需要：
1. ALTER TABLE 改列维度
2. 重建索引
3. 全量重新嵌入（可能耗时）

### 3.3 Spring 端 JPA 实体

```java
// backend-sb/src/main/java/com/emomind/entity/UserMemory.java
@Entity
@Table(name = "user_memory")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
public class UserMemory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "fact_text", nullable = false, columnDefinition = "TEXT")
    private String factText;

    @Column(name = "fact_text_hash", nullable = false, length = 64)
    private String factTextHash;

    @Column(name = "embedding", nullable = false, columnDefinition = "vector(1024)")
    @Convert(converter = VectorConverter.class)  // 自定义 JPA converter
    private float[] embedding;

    @Column(name = "category", nullable = false, length = 50)
    private String category;

    @Column(name = "importance", nullable = false)
    private Double importance;

    @Column(name = "source_thread_id")
    private String sourceThreadId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
```

> ⚠️ 实际写入 user_memory 的代码在 ai-runtime 而非 Spring。Spring 这边保留实体和 Repository 主要用于：
> - 管理后台查看用户记忆
> - 用户主动删除自己的某条记忆
> - GDPR 合规（用户注销时批量删除）

### 3.4 ai-runtime 端 UserMemoryStore

```python
# app/memory/long_term.py
import hashlib
from datetime import datetime
from typing import Optional
import numpy as np
from langchain_openai import OpenAIEmbeddings
import asyncpg

from app.config import settings


class UserMemoryStore:
    """封装 user_memory 表的所有操作。"""

    def __init__(self, db_pool: asyncpg.Pool):
        self._pool = db_pool
        self._emb = OpenAIEmbeddings(
            model=settings.embedding_model,
            openai_api_key=settings.embedding_api_key,
            openai_api_base=settings.embedding_base_url,
        )

    async def upsert(
        self,
        user_id: str,
        fact_text: str,
        category: str,
        importance: float,
        source_thread_id: Optional[str] = None,
    ) -> int:
        """
        插入或更新一条记忆。
        去重键：(user_id, fact_text_hash)
        """
        fact_hash = hashlib.sha256(fact_text.encode("utf-8")).hexdigest()
        embedding = await self._emb.aembed_query(fact_text)

        try:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    INSERT INTO user_memory
                        (user_id, fact_text, fact_text_hash, embedding, category,
                         importance, source_thread_id, created_at, updated_at)
                    VALUES ($1, $2, $3, $4::vector, $5, $6, $7, NOW(), NOW())
                    ON CONFLICT (user_id, fact_text_hash) DO UPDATE
                      SET embedding = EXCLUDED.embedding,
                          importance = EXCLUDED.importance,
                          updated_at = NOW()
                    RETURNING id
                    """,
                    user_id, fact_text, fact_hash,
                    "[" + ",".join(str(x) for x in embedding) + "]",
                    category, importance, source_thread_id,
                )
                return row["id"]
        except Exception as e:
            await self._write_dead_letter(user_id, fact_text, category, str(e))
            raise

    async def search(
        self,
        user_id: str,
        query: str,
        k: int = 5,
        min_similarity: float = 0.3,
    ) -> list[dict]:
        """按 query 检索最相关的 k 条记忆。"""
        query_embedding = await self._emb.aembed_query(query)
        query_vec_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, fact_text, category, importance, source_thread_id,
                       created_at, updated_at,
                       1 - (embedding <=> $1::vector) AS similarity
                FROM user_memory
                WHERE user_id = $2
                  AND 1 - (embedding <=> $1::vector) >= $3
                ORDER BY embedding <=> $1::vector ASC
                LIMIT $4
                """,
                query_vec_str, user_id, min_similarity, k,
            )
            return [dict(row) for row in rows]

    async def delete(self, user_id: str, memory_id: int) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM user_memory WHERE id = $1 AND user_id = $2",
                memory_id, user_id,
            )
            return result == "DELETE 1"

    async def delete_all_for_user(self, user_id: str) -> int:
        """GDPR：用户注销时清理。"""
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM user_memory WHERE user_id = $1",
                user_id,
            )
            # result 格式 "DELETE N"
            return int(result.split()[-1])

    async def _write_dead_letter(self, user_id, fact_text, category, error):
        try:
            async with self._pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO user_memory_dead_letter (user_id, fact_text, category, error)
                    VALUES ($1, $2, $3, $4)
                    """,
                    user_id, fact_text, category, error,
                )
        except Exception:
            pass  # dead_letter 写失败也吞掉，不影响主流程


_singleton: UserMemoryStore | None = None


def get_user_memory_store(db_pool: asyncpg.Pool) -> UserMemoryStore:
    global _singleton
    if _singleton is None:
        _singleton = UserMemoryStore(db_pool)
    return _singleton
```

### 3.5 在节点中使用

#### 加载（load_memory 节点）

```python
# app/graphs/nodes/load_memory.py
from app.graphs.state import GraphState
from app.memory.long_term import get_user_memory_store


async def load_memory(state: GraphState) -> dict:
    user_id = state.get("user_id")
    if not user_id:
        return {}

    messages = state.get("messages", [])
    if not messages:
        return {}

    # 用最近一条用户消息作为 query
    last_user_msg = next(
        (m for m in reversed(messages) if m.type == "human"),
        None,
    )
    if not last_user_msg:
        return {}

    store = get_user_memory_store(get_db_pool())
    memories = await store.search(
        user_id=user_id,
        query=last_user_msg.content,
        k=settings.long_term_memory_top_k,
    )

    # 格式化
    if memories:
        memory_text = "\n".join(
            f"- [{m['category']}] {m['fact_text']} (相关度: {m['similarity']:.2f})"
            for m in memories
        )
        system_msg = SystemMessage(
            content=f"以下是用户历史相关背景：\n{memory_text}\n"
        )
        return {"messages": [system_msg] + messages}

    return {}
```

#### 写入（write_long_term 节点，fire-and-forget）

```python
# app/graphs/nodes/write_long_term.py
import asyncio
from app.graphs.state import GraphState
from app.memory.long_term import get_user_memory_store


async def write_long_term(state: GraphState, facts: list[dict]):
    """
    fire-and-forget；调用方应不 await。
    """
    user_id = state.get("user_id")
    if not user_id:
        return

    store = get_user_memory_store(get_db_pool())
    for fact in facts:
        try:
            await store.upsert(
                user_id=user_id,
                fact_text=fact["fact"],
                category=fact.get("category", "fact"),
                importance=fact.get("importance", 0.5),
                source_thread_id=state.get("thread_id"),
            )
        except Exception as e:
            logger.error(f"Failed to write user memory: {e}")
            # 不抛；已经在 store.upsert 内部写 dead_letter


async def write_long_term_async(state: GraphState, facts: list[dict]):
    """包装为独立任务，不阻塞主流程。"""
    asyncio.create_task(write_long_term(state, facts))
```

#### extract_facts 节点

```python
# app/graphs/nodes/extract_facts.py
import json
from app.graphs.state import GraphState
from app.models.factory import get_chat_model
from app.prompts.loader import render_prompt
from app.llm_retry import call_llm


async def extract_facts(state: GraphState) -> dict:
    """从最近 N 条消息抽取结构化事实。"""
    user_id = state.get("user_id")
    if not user_id:
        return {}

    messages = state.get("messages", [])[-10:]  # 最近 10 条
    if not messages:
        return {}

    # 渲染 prompt
    messages_text = "\n".join(
        f"{m.type}: {m.content}" for m in messages
    )
    system_prompt = render_prompt("ai_doctor", "extract_facts__system")
    user_prompt = render_prompt(
        "ai_doctor", "extract_facts__user",
        messages=messages_text,
    )

    # 调 LLM 输出 JSON
    model = get_chat_model("minimax")
    response = await call_llm(
        model,
        [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)],
    )

    try:
        facts = json.loads(response.content)
    except json.JSONDecodeError:
        logger.warning(f"extract_facts: invalid JSON output: {response.content[:200]}")
        return {}

    # 触发写入（fire-and-forget）
    if facts:
        await write_long_term_async(state, facts)

    return {"extracted_facts": facts}
```

## 4. 缓存：Redis

### 4.1 数据结构

```
cancel:{thread_id}            → run_id (TTL=30s)
run:{thread_id}               → {run_id, user_id, graph} (TTL=300s)
stream:{thread_id}            → pub/sub channel（多 worker 模式，暂不用）
preview:{thread_id}           → 会话预览文本（TTL=600s）
hot_thread:{thread_id}        → 缓存最后消息（TTL=60s）
```

### 4.2 连接管理

```python
# app/memory/cache.py
import redis.asyncio as redis
from app.config import settings

_pool: redis.ConnectionPool | None = None


async def init_redis():
    global _pool
    _pool = redis.ConnectionPool.from_url(
        settings.redis_url,
        decode_responses=True,
        max_connections=50,
    )


async def close_redis():
    global _pool
    if _pool:
        await _pool.disconnect()


def get_redis() -> redis.Redis:
    return redis.Redis(connection_pool=_pool)
```

### 4.3 缓存策略

| 数据 | TTL | 写入时机 | 失效时机 |
|------|-----|---------|---------|
| `cancel:{thread_id}` | 30s | `/chat/stop` 触发 | TTL 自然过期 |
| `run:{thread_id}` | 300s | chat 开始 | 流结束时清除 |
| `preview:{thread_id}` | 600s | emit_response 后 | TTL 过期；列表查询时刷新 |
| `hot_thread:{thread_id}` | 60s | 任意 graph 节点完成后 | TTL 过期 |

### 4.4 降级

Redis 不可达时：
- `cancel` 机制失效（仅靠前端 abort）
- 缓存失效（直接查 Postgres）
- 主流程不中断

```python
async def safe_redis_op(op, *args, **kwargs):
    try:
        return await op(*args, **kwargs)
    except redis.ConnectionError as e:
        logger.warning(f"Redis unavailable: {e}")
        return None
```

## 5. 三层协同流程

### 5.1 新会话开始

```
[1] 用户发消息 → Spring → ai-runtime /v1/chat
    │
[2] graph 进入 load_memory 节点
    │  从 pgvector 检索 top-5 长期记忆
    │  注入 state.messages 开头
    │
[3] graph 跑节点，每步 checkpoint 自动写入 PostgresSaver
    │
[4] emit_response 后
    │  extract_facts → fire-and-forget 写入 pgvector
    │  Redis: SET preview:{thread_id} = first 100 chars
    │
[5] 流结束
    │  Redis: DEL cancel:{thread_id}, run:{thread_id}
```

### 5.2 续聊（resume）

```
[1] 用户发消息（带 thread_id） → /v1/chat
    │
[2] graph.aexecute(config={thread_id, ...})
    │  PostgresSaver 自动加载最近 checkpoint
    │  state.messages = 历史 + 新消息
    │
[3] load_memory 节点
    │  （可选：跳过，避免重复注入历史记忆）
    │
[4] 节点依次执行
    │
[5] emit_response → checkpoint 自动覆盖
```

### 5.3 中途停止

```
[1] 用户点停止 → /v1/chat/stop
    │  Redis: SETEX cancel:{thread_id} = run_id 30s
    │
[2] graph 协程下次循环检查 Redis
    │  if cancel flag 命中 → CancelledError
    │
[3] PostgresSaver 不写最终 checkpoint
    │  但已有的中间 checkpoint 保留
    │
[4] 用户重新点发送 → 新 run，thread_id 复用
    │  从最近中间 checkpoint 恢复
```

## 6. 容量与性能预估

| 项 | 预估 |
|----|------|
| 单用户 user_memory 条数 | 上限 1000（实施时加 LIMIT） |
| 单条 embedding 大小 | 1024 × 4 bytes = 4 KB |
| 1000 条 user_memory 总大小 | 4 MB |
| HNSW 索引大小（1000 条 × 1024 维）| 约 5-8 MB |
| 单次 search 耗时（k=5，1000 条）| p95 < 50ms |
| PostgresSaver 单 thread 平均大小 | 1-10 KB（取决于消息长度） |
| Redis 缓存单 key 大小 | < 1 KB |

容量监控：
- `user_memory` 表行数超阈值告警
- Redis 内存使用监控
- pgvector 索引大小监控

## 7. 清理与归档策略

| 数据 | 清理策略 |
|------|---------|
| `langgraph_checkpoints` | 用户删除 thread 时同步清理 |
| `user_memory` | 用户主动删除单条；GDPR 注销时全删 |
| `user_memory_dead_letter` | 每月清理 90 天前的记录 |
| Redis 所有 key | TTL 自然过期；不需要手动清理 |

## 8. 故障排查

| 症状 | 可能原因 | 排查 |
|------|---------|------|
| 续聊不恢复 | PostgresSaver 表损坏 | `SELECT * FROM langgraph_checkpoints WHERE thread_id=?` |
| 长期记忆搜不到 | pgvector 索引丢失 | `SELECT indexname FROM pg_indexes WHERE tablename='user_memory'` |
| Stop 不生效 | Redis 连接断开 | `redis-cli ping`；日志看 ConnectionError |
| 嵌入维度不匹配 | embedding 模型更换 | `SELECT vector_dims(embedding) FROM user_memory LIMIT 1` 应一致 |