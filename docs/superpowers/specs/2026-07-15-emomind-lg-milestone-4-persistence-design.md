# M4 Design Spec — Persistence layer (PostgresSaver + pgvector + V5 + real TestRecord)

**Date:** 2026-07-15
**Branch:** `emomind-lg`
**Baseline:** `659e818` (M3 merged to main; emomind-lg at `ec3eef8` = m3-psych-test)
**Status:** Design pre-approved by user 2026-07-15; ready for writing-plans

---

## Goal

Stand up the persistence layer for both ai-runtime graph state and the real TestRecord save. After this milestone:

- `ai_doctor` and `psych_test` graphs use `AsyncPostgresSaver` (replaces M3's `InMemorySaver`); thread state survives ai-runtime restarts
- pgvector long-term memory: `load_memory` reads top-K facts; `extract_facts + write_long_term` runs as fire-and-forget after `emit_response`
- `persist_test_record` writes a real `TestRecord` via Spring HTTP (replaces M3's stub)
- Per-user file ACL enforced in Spring `AiProxyService.proxyFileDownload` (403 on user_id mismatch)
- V5 Flyway migration adds `ConversationMeta` table

---

## Scope decisions (locked 2026-07-15)

| Decision | Choice |
|---|---|
| M4 scope | Full M4 (PostgresSaver + pgvector + real TestRecord + V5 + per-user ACL + Redis cancel) |
| Per-user file ACL | Spring `AiProxyService.proxyFileDownload` enforces (403 on mismatch) |
| Checkpointer | `AsyncPostgresSaver` (from `langgraph.checkpoint.postgres.aio`); auto-setup on first call |
| Long-term memory | `user_memory` table + `pgvector` HNSW index (1536-dim if real Qwen, but M3 spec uses 1024 — keep 1024) |
| `extract_facts` / `write_long_term` | Fire-and-forget `asyncio.create_task` triggered by `emit_response` (NOT graph nodes) |
| `persist_test_record` | Real Spring HTTP call via `AiProxyService.proxyTestRecordPersist` (replaces M3 stub) |
| ConversationMeta (V5) | Spring entity + Flyway migration + minimal controller (used for chat history metadata) |
| Redis cancel | M0 already has `redis.asyncio`; M4 wires `set_cancel_flag(thread_id)` on SSE disconnect; graph checks `is_cancelled(thread_id)` between nodes |
| Embedding model | `text-embedding-v3` (M3, 1024-dim) |

---

## Architecture

```
                        ┌─────────────────────────┐
                        │  Spring (M4 additions)  │
                        │                          │
                        │  V5 migration:          │
                        │    conversation_meta     │
                        │      id PK              │
                        │      user_id FK         │
                        │      graph TEXT         │
                        │      thread_id TEXT     │
                        │      title TEXT         │
                        │      metadata JSONB     │
                        │      created_at         │
                        │      updated_at         │
                        │                          │
                        │  AiProxyService:        │
                        │   + proxyTestRecord    │
                        │     Persist (idempotent) │
                        │   + proxyUserMemory    │
                        │     Query (top-K facts) │
                        │   + proxyFileDownload   │
                        │     + ACL: user_id     │
                        │     match check, 403    │
                        └─────────────────────────┘
                                    ↑ HTTPS + X-Internal-Token + X-User-Id
                                    │
┌─────────────────── ai-runtime (M4) ───────────────────────────┐
│                                                              │
│  app/memory/checkpointer.py (NEW)                            │
│    _checkpointer: AsyncPostgresSaver | None                  │
│    get_checkpointer() → singleton (lazy init,                 │
│      .from_conn_string(LANGGRAPH_DATABASE_URL),               │
│      .setup() auto-creates langgraph_checkpoints tables)      │
│                                                              │
│  app/memory/long_term.py (NEW)                               │
│    UserMemoryStore class                                     │
│      ensure_schema() → CREATE EXTENSION vector;              │
│        CREATE EXTENSION pgvector;                            │
│        CREATE TABLE user_memory (id, user_id,                 │
│          key, value, importance, embedding                   │
│          vector(1024), created_at, updated_at);              │
│        CREATE INDEX hnsw_idx ON user_memory                   │
│        USING hnsw (embedding vector_cosine_ops)             │
│      retrieve(user_id, query, top_k=5) → list[dict]        │
│        (Qwen embed query → cosine top-K → list)             │
│      upsert_fact(user_id, key, value, importance,           │
│        embedding)                                            │
│      dead_letter_failure(...) → M4 error log                 │
│                                                              │
│  app/graphs/ai_doctor.py (MODIFY)                            │
│    build_ai_doctor_graph() uses                              │
│      checkpointer=get_checkpointer()                          │
│    emit_response triggers:                                    │
│      asyncio.create_task(extract_facts_and_persist(state))    │
│                                                              │
│  app/graphs/psych_test.py (MODIFY — same as ai_doctor)        │
│    psych_test also uses PostgresSaver +                       │
│      persist_test_record → real Spring call                  │
│    (NO long-term memory for psych_test —                      │
│     spec doesn't require it; save as M5 scope)               │
│                                                              │
│  app/graphs/nodes/load_memory.py (REWRITE)                   │
│    Real impl: UserMemoryStore.retrieve(                       │
│      state["user_id"], state["messages"][-1].content,        │
│      top_k=5) → state["long_term_memory"] = [...]            │
│                                                              │
│  app/graphs/nodes/emit_response.py (MODIFY)                  │
│    After SSE emit, schedule extract_facts_and_persist:        │
│      if graph == "ai-doctor" and user_id set:               │
│        asyncio.create_task(_post_emit_long_term(state))      │
│                                                              │
│  app/graphs/nodes/persist_test_record.py (REWRITE)           │
│    Real impl: call aiProxyService.proxyTestRecordPersist(    │
│      user_id, graph, thread_id,                              │
│      test_name, user_topic, total_score, total_max,           │
│      result_description, questions, answers, scoring_ranges)  │
│      → returns test_record_id                                │
│                                                              │
│  app/graphs/nodes/_extract_facts.py (NEW)                    │
│    LLM call (MinMax): "extract user facts from messages"      │
│    → list[{"key": str, "value": str, "importance": 0-1}]      │
│    → UserMemoryStore.upsert_fact for each                      │
│                                                              │
│  app/api/chat.py (MODIFY)                                    │
│    Pass thread_id to graph (already does this)                │
│    Cancel handler: set_cancel_flag(thread_id) on disconnect   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## File Structure

### New files

```
backend-sb/src/main/resources/db/migration/V5__conversation_meta.sql
backend-sb/src/main/java/com/emomind/entity/ConversationMeta.java
backend-sb/src/main/java/com/emomind/controller/ConversationMetaController.java (or fold into AiController)
backend-sb/src/main/java/com/emomind/dto/request/ConversationMetaCreateRequest.java
backend-sb/src/main/java/com/emomind/dto/response/ConversationMetaResponse.java
backend-sb/src/main/java/com/emomind/repository/ConversationMetaRepository.java (Spring Data JPA)
backend-sb/src/test/java/com/emomind/service/AiProxyServiceFileAclTest.java

ai-runtime/app/memory/checkpointer.py
ai-runtime/app/memory/long_term.py
ai-runtime/app/graphs/nodes/_extract_facts.py
ai-runtime/tests/integration/test_checkpointer.py
ai-runtime/tests/integration/test_long_term.py
ai-runtime/tests/integration/test_ai_doctor_postgres.py
ai-runtime/tests/integration/test_psych_test_persistence.py

docs/superpowers/specs/2026-07-15-emomind-lg-milestone-4-persistence-design.md  (this file)
```

### Modified files

```
backend-sb/src/main/java/com/emomind/service/AiProxyService.java
  + proxyTestRecordPersist(userId, body) -> testRecordId
  + proxyFileDownload hardening with user_id ACL check (403 on mismatch)
  + proxyUserMemoryQuery(userId, query, topK) -> list[MemoryFact]

backend-sb/src/main/java/com/emomind/controller/FileController.java
  ~ Use the hardened proxyFileDownload

backend-sb/src/main/java/com/emomind/controller/AiController.java
  ~ No structural change; just routes through AiProxyService

ai-runtime/app/graphs/ai_doctor.py
  ~ build_ai_doctor_graph() uses checkpointer=get_checkpointer()
  ~ emit_response edge triggers _post_emit_long_term (fire-and-forget)

ai-runtime/app/graphs/psych_test.py
  ~ build_psych_test_graph() uses checkpointer=get_checkpointer()
  ~ persist_test_record uses real Spring call

ai-runtime/app/graphs/nodes/load_memory.py
  ~ Real impl (replace stub)

ai-runtime/app/graphs/nodes/emit_response.py
  + After emit, schedule extract_facts_and_persist task (only for ai_doctor)

ai-runtime/app/graphs/nodes/persist_test_record.py
  ~ Real Spring HTTP call (replace stub)

ai-runtime/app/api/chat.py
  + Cancel handler: set_cancel_flag on SSE disconnect
  + Pass thread_id to graph (already does this)

ai-runtime/app/config.py
  (no change — LANGGRAPH_DATABASE_URL + LANGGRAPH_REDIS_URL + embedding settings already in M0/M3)

ai-runtime/pyproject.toml
  + pgvector (Python wrapper) — verify needed
  + asyncpg already present
  + redis already present

ai-runtime/tests/conftest.py
  + Verify test fixtures: pgvector-test container, test bank cleanup (existing)
```

---

## Schema (V5 migration)

`backend-sb/src/main/resources/db/migration/V5__conversation_meta.sql`:

```sql
-- LangGraph PostgresSaver (M0 already creates these via setup())
-- No action needed; document here for reference.

-- ConversationMeta (new in V5)
CREATE TABLE conversation_meta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    graph VARCHAR(64) NOT NULL,                  -- 'ai-doctor' | 'psych-test'
    thread_id VARCHAR(128) NOT NULL,            -- matches LangGraph thread_id
    title VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, graph, thread_id)
);

CREATE INDEX idx_conversation_meta_user_id ON conversation_meta(user_id);
CREATE INDEX idx_conversation_meta_thread_id ON conversation_meta(graph, thread_id);
```

`user_memory` (managed by ai-runtime, not Flyway):

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS user_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    importance REAL NOT NULL DEFAULT 0.5,         -- 0.0 to 1.0
    embedding vector(1024),                     -- text-embedding-v3 dim
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for cosine similarity (per M3 spec)
CREATE INDEX IF NOT EXISTS hnsw_user_memory_embedding
    ON user_memory
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON user_memory(user_id);

-- dead_letter (for failed long_term writes; per 04-error-handling.md)
CREATE TABLE IF NOT EXISTS long_term_dead_letter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    payload JSONB NOT NULL,
    error TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## API surface

### Spring (new)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/ai/test-records` | JWT | Persist TestRecord from ai-runtime (idempotent on (user_id, graph, thread_id)) |
| GET | `/api/v1/ai/test-records/{threadId}` | JWT | Retrieve TestRecord by thread_id |
| GET | `/api/v1/ai/conversations?userId=X&graph=Y` | JWT | List ConversationMeta for user |
| (FileController hardened) | (no path change) | JWT | `proxyFileDownload` validates user_id == file.user_id; 403 on mismatch |

### ai-runtime (new)

| Function | Signature | Description |
|---|---|---|
| `get_checkpointer() -> AsyncPostgresSaver` | (no args) | Lazy singleton; auto-setup() on first call |
| `UserMemoryStore.ensure_schema()` | `() -> None` | CREATE EXTENSION + CREATE TABLE; idempotent |
| `UserMemoryStore.retrieve(user_id, query, top_k=5)` | `(str, str, int) -> list[dict]` | Embed query → cosine top-K |
| `UserMemoryStore.upsert_fact(user_id, key, value, importance, embedding)` | `(str, str, str, float, list[float]) -> None` | INSERT or UPDATE |
| `extract_facts(state)` | `(PsychTestState\|AiDoctorState) -> list[dict]` | LLM call to MinMax; returns `[{"key", "value", "importance"}]` |
| `extract_facts_and_persist(state)` | `(state) -> None` | Fire-and-forget: extract → embed → upsert_fact; failures go to dead_letter |
| `set_cancel_flag(thread_id)` | `(str) -> None` | ai-runtime: Redis SETEX with TTL |
| `is_cancelled(thread_id)` | `(str) -> bool` | ai-runtime: Redis GET |

---

## Component contracts

```python
# app/memory/checkpointer.py
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from app.config import settings

_checkpointer: AsyncPostgresSaver | None = None

async def get_checkpointer() -> AsyncPostgresSaver:
    global _checkpointer
    if _checkpointer is None:
        _checkpointer = AsyncPostgresSaver.from_conn_string(settings.database_url)
        await _checkpointer.setup()  # auto-creates langgraph_checkpoints tables
    return _checkpointer
```

```python
# app/memory/long_term.py
from dataclasses import dataclass
from typing import Optional
import asyncpg
from app.config import settings
from app.models.embedding import get_embedding_provider

@dataclass
class MemoryFact:
    key: str
    value: str
    importance: float
    score: float  # cosine similarity, 0..1

class UserMemoryStore:
    def __init__(self, db_pool: asyncpg.Pool, embedding_provider):
        self._db = db_pool
        self._embedding = embedding_provider

    @classmethod
    async def create(cls) -> "UserMemoryStore":
        db = await asyncpg.create_pool(settings.database_url, min_size=2, max_size=10)
        inst = cls(db, get_embedding_provider("text-embedding-v3"))
        await inst.ensure_schema()
        return inst

    async def ensure_schema(self) -> None:
        async with self._db.acquire() as conn:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS user_memory (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    importance REAL NOT NULL DEFAULT 0.5,
                    embedding vector(1024),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );""")
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS hnsw_user_memory_embedding
                    ON user_memory USING hnsw (embedding vector_cosine_ops);""")
            # dead_letter
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS long_term_dead_letter (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID,
                    payload JSONB NOT NULL,
                    error TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );""")

    async def retrieve(self, user_id: str, query: str, top_k: int = 5) -> list[MemoryFact]:
        emb = (await self._embedding.embed([query]))[0]
        async with self._db.acquire() as conn:
            rows = await conn.fetch("""
                SELECT key, value, importance, 1 - (embedding <=> $1::vector) AS score
                FROM user_memory
                WHERE user_id = $2::uuid
                ORDER BY embedding <=> $1::vector
                LIMIT $3
            """, emb, user_id, top_k)
        return [MemoryFact(r["key"], r["value"], r["importance"], r["score"]) for r in rows]

    async def upsert_fact(self, user_id: str, key: str, value: str,
                          importance: float, embedding: list[float]) -> None:
        async with self._db.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_memory (user_id, key, value, importance, embedding)
                VALUES ($1::uuid, $2, $3, $4, $5::vector)
                ON CONFLICT (user_id, key) DO UPDATE
                SET value = EXCLUDED.value,
                    importance = EXCLUDED.importance,
                    embedding = EXCLUDED.embedding,
                    updated_at = NOW()
            """, user_id, key, value, importance, embedding)
```

```python
# app/graphs/nodes/_extract_facts.py
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.prompts.loader import render_prompt
from app.memory.long_term import UserMemoryStore

# Module-level singleton (created in chat.py startup or lazy)
_store: UserMemoryStore | None = None

async def get_store() -> UserMemoryStore:
    global _store
    if _store is None:
        _store = await UserMemoryStore.create()
    return _store

async def extract_facts(state, model=None) -> list[dict]:
    """LLM call: extract user facts from conversation messages.
    Returns [{"key": str, "value": str, "importance": 0-1}, ...]
    """
    llm = model or get_chat_model("minimax")
    messages_text = "\n".join(
        m["content"] if isinstance(m, dict) else m.content
        for m in state.get("messages", [])
    )
    system = render_prompt("ai_doctor", "system_prompt")
    user = render_prompt("ai_doctor", "extract_facts", messages=messages_text)
    reply = await call_llm(llm, [SystemMessage(content=system), HumanMessage(content=user)])
    # LLM returns JSON list
    # ... parse + return

async def extract_facts_and_persist(state) -> None:
    """Fire-and-forget: extract + embed + upsert. Failures go to dead_letter."""
    try:
        facts = await extract_facts(state)
        store = await get_store()
        for f in facts:
            emb = (await store._embedding.embed([f["value"]]))[0]
            await store.upsert_fact(
                user_id=state["user_id"],
                key=f["key"],
                value=f["value"],
                importance=f["importance"],
                embedding=emb,
            )
    except Exception as e:
        # log to dead_letter
        try:
            async with store._db.acquire() as conn:
                await conn.execute(
                    "INSERT INTO long_term_dead_letter (user_id, payload, error) VALUES ($1, $2, $3)",
                    state.get("user_id"), json.dumps(state), str(e),
                )
        except Exception:
            log.exception("dead_letter write failed")
```

```java
// AiProxyService.java — proxyFileDownload hardening
public Mono<byte[]> proxyFileDownload(String fileId, UUID userId) {
    String traceId = UUID.randomUUID().toString();
    return aiRuntimeWebClient.get()
        .uri("/v1/files/{fileId}", fileId)
        .header("X-User-Id", userId.toString())
        .header("X-Internal-Token", props.getInternalToken())
        .header("X-Trace-Id", traceId)
        .retrieve()
        .onStatus(HttpStatusCode::is4xxClientError, resp -> {
            // ai-runtime returns 404 for "file not found for this user"
            // Spring translates to 404 (file truly missing) or 403 (user mismatch)
            if (resp.statusCode().value() == 404) {
                // 404 from ai-runtime could mean: file doesn't exist, OR user_id mismatch
                // We need to distinguish. Use a separate GET /v1/files/{id}/meta to check owner.
                return resp.bodyToMono(String.class).flatMap(body ->
                    Mono.error(new FileAccessDeniedException("File not found or access denied"))
                );
            }
            return resp.createException();
        })
        .bodyToMono(byte[].class)
        .doOnError(e -> log.error("ai-runtime file download error trace={}", traceId, e));
}
```

**Simplification**: instead of the complex error-mapping, ai-runtime's `read_file` should return a 403 (not 404) when user_id mismatches. Spring just propagates. Cleaner.

```java
// ai-runtime files.py — fix read_file to raise HTTPException(403) on user mismatch
@router.get("/{file_id}")
async def get_file(file_id: str, user_id: str = Depends(verify_internal_token)):
    meta = get_meta(file_id)
    if meta is None:
        raise HTTPException(status_code=404, detail={"code": "FILE_NOT_FOUND"})
    if meta.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail={"code": "FILE_ACCESS_DENIED"})
    content = read_file(file_id, user_id)
    if content is None:
        raise HTTPException(status_code=404, detail={"code": "FILE_NOT_FOUND"})
    return Response(content=content, media_type=meta["mime"])
```

---

## Test strategy

Per task TDD. 9 tasks total.

| # | Scope | Test approach |
|---|---|---|
| T1 | Spring V5 migration + ConversationMeta entity + repo | JPA test + Flyway test (Testcontainers) |
| T2 | Spring `AiProxyService.proxyTestRecordPersist` + file ACL hardening | MockWebServer + Spring Security test |
| T3 | ai-runtime `checkpointer.py` (PostgresSaver) | Integration test: compile graph, run 2 turns, restart, verify state |
| T4 | ai-runtime `long_term.py` (UserMemoryStore + pgvector) | Integration: insert fact, retrieve by query similarity |
| T5 | ai-runtime `_extract_facts.py` | Unit test: mock LLM, assert fact list shape |
| T6 | ai-runtime graph changes (PostgresSaver, real persist, real load_memory, emit_response hook) | Integration: full graph run with PostgresSaver; assert real TestRecord save + long-term persist (asyncio.sleep + db query) |
| T7 | ai-runtime integration tests (PostgresSaver + pgvector end-to-end) | Multi-test: cache + checkpointer + long-term in same graph run |
| T8 | Spring integration tests (ConversationMeta controller + file ACL) | MockMvc: 403 on user mismatch, 200 on match |
| T9 | Verification + tag m4-persistence + Playwright spec | 4 gates; Playwright spec for persistence flow |

---

## Verification (per task + final T9)

```bash
# Java (via scripts/test.sh)
cd backend-sb && bash scripts/test.sh

# Python
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key \
  LANGGRAPH_EMBEDDING_API_KEY=test-key LANGGRAPH_INTERNAL_TOKEN=changeme-internal-token-must-be-32-chars-long \
  uv run pytest

# Frontend
cd frontend && bun run lint

# Compose
docker compose -f compose.yml -f compose.override.yml config > /dev/null
```

**CI workflow** must include the new env vars. The implementer should update `.github/workflows/ai-runtime.yml` to add `LANGGRAPH_QWEN_EMBEDDING_API_KEY` (already in T1's updates) + confirm pgvector-test container runs.

---

## Known M4 trade-offs (defer to M5+ unless blocking)

- **PG password in connection string**: `LANGGRAPH_DATABASE_URL` includes credentials. The brief is OK with this for now (M0 already does it). M5 could move to secrets manager.
- **`psycopg` vs `asyncpg`**: LangGraph's `AsyncPostgresSaver` uses `psycopg[binary,pool]`. ai-runtime's existing asyncpg is for direct queries. Two drivers = two connection pools to Postgres. Acceptable; explicit comment in code.
- **No LLM cost control on `extract_facts`**: each ai_doctor turn triggers 1 extra LLM call (the extract). ~30-40% more LLM tokens per session. Acceptable for M4; M5 can add sampling (every Nth turn, not every turn).
- **`InMemorySaver` removed in M4**: testing will be slower (real Postgres dependency). M3 InMemorySaver was good for unit tests. M4 path: use Testcontainers for integration tests; mock checkpointer for unit tests if needed.
- **ConversationMeta never read by ai-runtime**: M4 only adds the table + minimal Spring CRUD; ai-runtime doesn't query it. M5 brings chat history UI.
- **File ACL only on `proxyFileDownload`**: not on `proxyFileUpload` (uploads are always owned by the upload's X-User-Id — no ACL needed). Not on `proxyFileList` (M0 doesn't have one).

---

## Out of scope (deferred to M5+)

- ❌ useChat.ts full rewrite + 5 other frontend files cleanup (M5)
- ❌ Redis cancel-flag M0 infrastructure full wiring (M4 adds it; M5 polishes)
- ❌ Chat history UI for ConversationMeta (M5)
- ❌ File dedup / virus scan / OCR fallback (M+)
- ❌ Report i18n / PDF export (M+)
- ❌ M3 streaming gap fix (workflow_event for state.questions) — M4/M5
- ❌ Real test LLM for M3 (test_record_id was M3 STUB) — M4 fixes via T2

---

## Task ordering (for writing-plans)

1. **T1** Spring V5 migration + ConversationMeta (foundation)
2. **T2** Spring `AiProxyService` (proxyTestRecordPersist + ACL hardening)
3. **T3** ai-runtime `checkpointer.py` (PostgresSaver singleton)
4. **T4** ai-runtime `long_term.py` (pgvector)
5. **T5** ai-runtime `_extract_facts.py` (LLM extraction)
6. **T6** ai-runtime graph changes (PostgresSaver + real persist + real load_memory + emit hook)
7. **T7** ai-runtime integration tests (full Postgres + pgvector E2E)
8. **T8** Spring integration tests (ConversationMeta controller + file ACL)
9. **T9** Verification + tag m4-persistence + Playwright spec + final report

Per skill: 9 tasks is the upper bound for "a single subagent holds all the relevant code in context". T4 is the largest (~4-6h equivalent: ai-runtime + pgvector + integration tests). Splitting T4 (e.g., into T4a schema + T4b retrieve+upsert) would help if T4 is too large for a single subagent. Decision deferred to writing-plans.
