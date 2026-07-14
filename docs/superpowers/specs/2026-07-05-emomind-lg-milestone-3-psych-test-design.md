# M3 Design Spec — psych_test graph + RAG-based question selection

**Date:** 2026-07-05
**Branch:** `emomind-lg`
**Baseline:** `73415d8` (M2 + M3 perf cleanup merged to main; emomind-lg at `7e9cdbc` + main merge `73415d8`)
**Status:** Design approved 2026-07-05; ready for writing-plans

---

## Goal

Stand up the end-to-end psych_test flow: users start a dynamic 30-question psychological assessment (Q&A in natural language), the ai-runtime psych_test graph (12 nodes, 3 phases: guide / testing / reporting) selects 30 questions from a 135-item bank via real-RAG (embeddings + dimension-aware vector retrieval), LLM scores each answer on a 0-4 Likert scale, generates a structured per-dimension report, and (stub) persists a TestRecord.

**Non-goals (deferred to M4+):**

- TestRecord real persistence (M3 stub returns `test_record_id="stub-<uuid>"`)
- PostgresSaver / pgvector long-term memory (`load_memory` M3 stub returns `{}`)
- V5 ConversationMeta migration (M4)
- Redis cancel / stop / pause / resume (M5)
- `useChat.ts` full rewrite + cleanup of 5 other frontend files still importing `difyApi` (M5)
- Per-user file ACL (M4)
- AI-generated dynamic questions (M3 ships 9 dims × 15 questions = 135 fixed; future M+ may add AI-gen)
- `clarify_answer` node always-skipped (M3 sets `answer_ambiguous=False`; LLM-based ambiguity detection is M5)
- Test-retest reliability (1 question measured multiple times)
- Report i18n
- PDF export / print

---

## Scope decisions (locked in brainstorming 2026-07-05)

| Decision | Choice |
|---|---|
| M3 scope | Full 12 nodes; M4 deps stubbed |
| Test templates | User-provided `knowledge-base-questions.txt` (63 questions, 9 dims) extended to 135 questions (15 per dim) |
| Question selection | Real RAG: Qwen embeddings + dimension-aware vector retrieval; 30 questions per test |
| Intent source | Frontend provides; backend `intent_classifier` is a thin validator (no LLM) |
| Checkpointer | `InMemorySaver` (thread state in ai-runtime process; lost on restart) |
| Frontend scope | Rewrite `routes/user/test/index.tsx` with new 3-phase flow; leave `chat/$sessionId.tsx` for M5 |
| Q&A loop | Template-driven: questions from bank in fixed order; LLM only scores answers |
| Scoring scale | 0-4 Likert (0=从不, 1=很少, 2=有时, 3=经常, 4=总是); high = more symptoms |
| Storage | In-memory embeddings + FAISS-cpu vector index; question bank JSON in `ai-runtime/app/test_templates/question_bank.json` |

---

## Architecture

```
React /user/test/index.tsx (rewrite)
  ↓
  ├─ 阶段 1: <TestIntake /> — user pastes free-text "我最近心情低落、失眠、压力大"
  ↓
  ├─ sendChatStream("psych-test", {input: {messages: [user_text], conversation_id}, callbacks})
  ↓
  Spring POST /api/v1/ai/chat (M2; new graph="psych-test" routing)
  ↓ AiProxyService.proxyChatStream (SSE passthrough)
  ↓
  ai-runtime POST /v1/chat
  ↓ chat.py → graph == "psych-test" → build_psych_test_graph()
  ↓
  psych_test graph (12 nodes, InMemorySaver, thread_id = conversation_id)
  │
  │  ┌─ load_test_template  (module-level cache: 135 questions + 9 dim centroids + per-question embeddings)
  │  ├─ load_memory         (stub: return {})
  │  ├─ intent_classifier  (thin validator: trust frontend intent)
  │  │
  │  ├─[conditional: route_by_intent]─┐
  │  │                                 │
  │  │  intent=start_test              intent=answer
  │  │           │                             │
  │  │           ▼                             ▼
  │  │  generate_first_question       analyze_answer (LLM: 0-4 score + emotion tags)
  │  │  (RAG: select 30 questions             │
  │  │   + 1 LLM intake confirmation)        ▼
  │  │           │                       update_progress (pure logic)
  │  │           │                             │
  │  │  intent=ask_howto/chitchat   ┌─[route_after_answer]─┐
  │  │           │                 │  current<30   current==30 │
  │  │           ▼                 │     │              │      │
  │  │   guide_assistant (LLM)     │     ▼              ▼      │
  │  │           │                 │ generate_next    generate_report (LLM)
  │  │           │                 │   _question            │
  │  │           │                 │     │              │      │
  │  │           │                 │     │              ▼      │
  │  │           │                 │     │       persist_test_record (STUB)
  │  │           │                 │     │              │      │
  │  │           │                 │     └──────┬───────┘      │
  │  │           │                 │            │              │
  │  │           └────────┬────────┘            ▼              │
  │  │                    │             emit_response → END  │
  │  │                    ▼                                │
  │  └────────► emit_response → END                       │
  │                                                            │
  └────────────────────────────────────────────────────────────
       ↓ (SSE frames back to frontend)
       frontend re-renders based on phase
```

---

## File Structure

### New Python files (ai-runtime)

```
ai-runtime/app/graphs/psych_test.py
ai-runtime/app/graphs/nodes/_test_bank_cache.py        module-level cache (questions + embeddings + dim centroids)
ai-runtime/app/graphs/nodes/load_test_template.py
ai-runtime/app/graphs/nodes/load_memory.py              stub
ai-runtime/app/graphs/nodes/intent_classifier.py       thin validator
ai-runtime/app/graphs/nodes/guide_assistant.py
ai-runtime/app/graphs/nodes/generate_first_question.py
ai-runtime/app/graphs/nodes/generate_next_question.py
ai-runtime/app/graphs/nodes/analyze_answer.py
ai-runtime/app/graphs/nodes/update_progress.py
ai-runtime/app/graphs/nodes/clarify_answer.py          (skipped via route_after_answer=False)
ai-runtime/app/graphs/nodes/generate_report.py
ai-runtime/app/graphs/nodes/persist_test_record.py     stub
ai-runtime/app/test_templates/question_bank.json        135 questions (9 dims × 15)
```

### Modified Python files

```
ai-runtime/app/config.py                              +embedding_api_key, +embedding_model, +embedding_base_url
ai-runtime/app/models/factory.py                      +"text-embedding-v3" provider
ai-runtime/app/models/embedding.py                    new QwenEmbeddingProvider (DashScope text-embedding-v3)
ai-runtime/app/api/chat.py                            graph=="psych-test" → build_psych_test_graph()
ai-runtime/app/graphs/state.py                        +PsychTestState
ai-runtime/pyproject.toml                             +faiss-cpu, +numpy
```

### New Python tests

```
ai-runtime/tests/unit/test_load_test_template.py
ai-runtime/tests/unit/test_intent_classifier.py
ai-runtime/tests/unit/test_guide_assistant.py
ai-runtime/tests/unit/test_generate_first_question.py
ai-runtime/tests/unit/test_analyze_answer.py
ai-runtime/tests/unit/test_update_progress.py
ai-runtime/tests/unit/test_generate_report.py
ai-runtime/tests/integration/test_psych_test_init.py          start_test path
ai-runtime/tests/integration/test_psych_test_qa_loop.py       30-Q&A flow
ai-runtime/tests/integration/test_psych_test_graph.py        full graph E2E
ai-runtime/tests/integration/test_psych_test_report.py        report generation
```

### Modified Python tests

```
ai-runtime/tests/conftest.py                          +LANGGRAPH_EMBEDDING_API_KEY
ai-runtime/tests/integration/test_chat_endpoint.py    +1 psych-test endpoint test
```

### New Frontend files

```
frontend/src/routes/user/test/components/TestIntake.tsx
frontend/src/routes/user/test/components/TestQuestion.tsx
frontend/src/routes/user/test/components/TestReport.tsx
frontend/src/routes/user/test/components/ProgressBar.tsx
frontend/src/routes/user/test/lib/localStorage.ts
frontend/tests/psych_test_flow.spec.ts                Playwright spec
```

### Modified Frontend files

```
frontend/src/routes/user/test/index.tsx               rewrite (use new components + sendChatStream)
```

---

## State extension

```python
class PsychTestState(GraphState):
    # intent routing
    intent: Optional[Literal["ask_howto", "start_test", "answer", "chitchat"]]
    phase: Optional[Literal["guide", "testing", "reporting"]]

    # loaded test bank (cached; same for all sessions in one ai-runtime process)
    test_bank: Optional[dict]              # {question_id: {text, dimension, dimension_cn, keywords}}

    # 30 selected questions for current test
    questions: Optional[list[str]]         # ["mood_001", "mood_004", "sleep_001", ...]

    # current Q&A
    pending_question: Optional[dict]      # {"id": "mood_001", "text": "你是否...", "dimension": "mood"}
    current: Optional[int]                # 0..30
    answers: Optional[list[dict]]         # [{"question_id": "mood_001", "score": 2, "answer_text": "..."}, ...]

    # progress
    test_progress: Optional[dict]         # {"current": int, "total": 30, "scores": {"mood":[...], "sleep":[...], ...}}

    # emotion tags from analyze_answer
    emotion_tags: Optional[list[str]]

    # report
    report: Optional[dict]                # {"total_score": int, "dimension_breakdown": {...}, "interpretation": str, "recommendations": str}

    # test record (stub for M3)
    test_record_id: Optional[str]

    # standard (from M1 GraphState)
    user_id, thread_id, run_id
```

---

## Module-level cache (NOT in state)

```python
# app/graphs/nodes/_test_bank_cache.py
@dataclass
class TestBankCache:
    questions: list[dict]
    question_embeddings: dict[str, list[float]]   # question_id → 1024-dim vector
    dim_centroids: dict[str, list[float]]        # dimension → centroid (mean of question embeddings in that dim)
    loaded: bool = False

_cache = TestBankCache()

async def ensure_loaded(settings, embedding_provider) -> TestBankCache:
    if _cache.loaded:
        return _cache
    # 1. Load question_bank.json from disk
    # 2. Embed each question (batched; one API call returns list of vectors)
    # 3. Compute per-dimension centroids
    _cache.loaded = True
    return _cache
```

---

## RAG selection algorithm

**Inputs:**
- `user_input_text` (from `state.messages[-1].content` for `start_test`)
- `TestBankCache` (135 questions + embeddings + centroids)

**Steps:**

1. Embed `user_input_text` via Qwen embedding (1 API call)
2. For each of 9 dimensions, compute cosine sim between user embedding and that dim's centroid → rank dimensions
3. Pick **top 3 primary dimensions** (by centroid similarity)
4. **Hand-coded related dimensions mapping** (small dict):
   - `mood ↔ interest`
   - `sleep ↔ cognitive ↔ anxiety`
   - `social ↔ irritability`
   - `motivation ↔ stress`
5. From primary dimensions, take top 10 questions each (by per-question cosine sim to user embedding). If a primary dim has < 10 questions (shouldn't happen since 15/dim), fall back to its related dims.
6. If still < 30 (e.g., top 3 dims are tiny), iterate related dims to fill.
7. Total: 30 question_ids → write to `state.questions`.

**Complexity:** 135 cosine sims (in-memory, numpy) ≈ < 1ms. One Qwen embedding API call (~50ms).

---

## 12 nodes + 2 routing functions (per spec, with M3 simplifications)

**12 functional nodes:**

| Node | LLM? | Role | M3 behavior |
|---|---|---|---|
| `load_test_template` | **once (Qwen embedding)** | Load 135 questions + compute embeddings + dim centroids | First call ~30s (135 embeddings); cached in module-level `_test_bank_cache` |
| `load_memory` | no | Load long-term memory (M3 stub) | `return {}` |
| `intent_classifier` | no | Validate intent from frontend | thin validator (raise if invalid) |
| `guide_assistant` | **yes (MinMax)** | LLM reply for ask_howto/chitchat | prompt + MinMax + render |
| `generate_first_question` | **yes (Qwen embedding + LLM)** | Select 30 questions via RAG + intake confirmation | embed user + RAG select + LLM intake reply |
| `generate_next_question` | no | Return `state.questions[state.current]` | simple list lookup |
| `analyze_answer` | **yes (MinMax)** | Score 0-4 + emotion tags | LLM returns JSON `{score, emotion_tags}` |
| `update_progress` | no | Pure logic: ++current, route next/clarify/complete | always sets `answer_ambiguous=False` (M3) |
| `clarify_answer` | **yes (MinMax)** | LLM clarification prompt | (M3: never reached; route_after_answer skips) |
| `generate_report` | **yes (MinMax)** | Total score + per-dim + interpretation + recommendations | structured JSON output |
| `persist_test_record` | no | Save TestRecord (M3 stub) | log + return `test_record_id="stub-<uuid>"` |
| `emit_response` | no | SSE event emission | reuse M2's emit_response |

**2 routing functions** (not nodes; conditional edge functions):

| Function | LLM? | Role |
|---|---|---|
| `route_by_intent` | no | Conditional edge after `intent_classifier`: returns node name based on `state.intent` |
| `route_after_answer` | no | Conditional edge after `update_progress`: returns `next_question` OR `complete` (clarify never in M3) |

**Reused from M2 (no changes):**
- `emit_response` (the SSE event emitter)
- `MinMaxProvider` (text generation)
- `QwenOmniProvider` (multimodal — not used in M3)
- `Streaming` module (chat.py wrapper)

---

## LLM call budget per test (30 questions)

| Stage | Calls |
|---|---|
| 1 Qwen embedding (user intake) | 1 |
| 1 LLM intake confirmation | 1 |
| 30 × analyze_answer (1 LLM per question) | 30 |
| 1 × generate_report | 1 |
| **Total** | **~33 calls** |

Plus optional `guide_assistant` (~1 call) if intent is `ask_howto` or `chitchat`.

---

## Conditional edges

```python
g.add_conditional_edges("intent_classifier", route_by_intent, {
    "ask_howto": "guide_assistant",
    "start_test": "generate_first_question",
    "answer": "analyze_answer",
    "chitchat": "guide_assistant",
})
g.add_edge("guide_assistant", "emit_response")
g.add_edge("generate_first_question", "emit_response")
g.add_edge("emit_response", END)  # wait for next user input

g.add_edge("analyze_answer", "update_progress")
g.add_conditional_edges("update_progress", route_after_answer, {
    "next_question": "generate_next_question",
    "clarify": "clarify_answer",  # M3: never reached (answer_ambiguous=False)
    "complete": "generate_report",
})
g.add_edge("generate_next_question", "emit_response")
g.add_edge("clarify_answer", "emit_response")
g.add_edge("generate_report", "persist_test_record")
g.add_edge("persist_test_record", "emit_response")
```

---

## Scoring

- Per question: 0-4 Likert (LLM `analyze_answer` returns integer 0..4)
- Per dimension: `sum(question_scores_in_dim)` divided by `(5 * 4) = 20` → normalized 0-100%
  - (5 questions per dim × max 4 = max 20 per dim; M3 may pick 4-5 questions per dim so divisor adjusts)
- Total: `mean(per_dim_normalized_scores)` → 0-100%
- Report structure:
  ```json
  {
    "total_score": 56,
    "total_score_normalized": 62,
    "dimension_breakdown": {
      "mood": {"score": 12, "max": 20, "normalized": 60, "level": "中度"},
      "sleep": {"score": 14, "max": 20, "normalized": 70, "level": "中度"},
      ...
    },
    "interpretation": "（LLM 生成）",
    "recommendations": "（LLM 生成）"
  }
  ```

---

## Frontend flow (`routes/user/test/index.tsx` rewrite)

**Single-page 3-phase state machine:**

```
Phase 1: INTAKE
  ├─ User pastes free-text into textarea
  ├─ Clicks "开始测试"
  ├─ Frontend sends {graph: "psych-test", intent: "start_test", input: {messages: [user_text], conversation_id}}
  └─ Wait for SSE: run_start → token (intake confirmation) → message_end

Phase 2: Q&A LOOP (30 rounds)
  ├─ Display pending_question.text + 4 Likert option buttons (0/1/2/3/4) + free-text textarea
  ├─ User selects score + optional text → clicks "下一题"
  ├─ Frontend sends {graph: "psych-test", intent: "answer", input: {messages: [{role: "assistant", content: question_text}, {role: "user", content: user_answer + " " + score_label}], conversation_id}}
  ├─ Wait for SSE: run_start → node_start (analyze_answer, update_progress, generate_next_question) → token (next question text) → message_end
  └─ Update local progress (current++)

Phase 3: REPORT
  ├─ Backend's last message_end carries state.report JSON
  ├─ Frontend renders:
  │   ├─ Total score + 100% normalized
  │   ├─ 9-dimension radar/bar chart (Recharts or simple divs)
  │   ├─ LLM interpretation
  │   ├─ LLM recommendations
  │   └─ test_record_id (with "STUB" badge — reminds this is M3 stub)
  └─ localStorage cleared
```

**localStorage backup:**
- Save `{conversation_id, current, answers}` after each answer submit
- Read on page load → restore partial state
- Cleared on report view

**Components:**
```
routes/user/test/index.tsx (~300 lines, was 6)
  ├─ <TestIntake />       — phase 1
  ├─ <TestQuestion />     — phase 2 (single question UI, reused 30×)
  ├─ <TestReport />       — phase 3
  └─ <ProgressBar />      — 1/30, 2/30, ..., 30/30
```

**`langgraphApi.ts` (M1 T7 already updated):** `sendChatStream(graph: "psych-test", ...)` — no change needed.

---

## Dependencies (additions to `ai-runtime/pyproject.toml`)

```toml
dependencies = [
    # ... existing ...
    "faiss-cpu>=1.8",          # in-memory vector index
    "numpy>=1.26",              # cosine similarity + array math
]
```

**No new Python deps for the embedding model** — `QwenEmbeddingProvider` reuses the existing DashScope HTTP path (Qwen embedding API is OpenAI-compatible).

---

## Configuration additions (`.env.example`, `compose.yml`)

```env
# M3: embedding model (Qwen text-embedding-v3 via DashScope)
LANGGRAPH_EMBEDDING_API_KEY=your-embedding-api-key
LANGGRAPH_EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LANGGRAPH_EMBEDDING_MODEL=text-embedding-v3
LANGGRAPH_EMBEDDING_DIM=1024
```

`compose.yml`: add the 4 new env keys to ai-runtime service.
`.github/workflows/ai-runtime.yml`: add `LANGGRAPH_EMBEDDING_API_KEY: test-key`.

---

## Verification (per task TDD)

```bash
# Per task:
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key \
  LANGGRAPH_INTERNAL_TOKEN=changeme-internal-token-must-be-32-chars-long \
  LANGGRAPH_EMBEDDING_API_KEY=test-key \
  uv run pytest tests/<path>::test_name -v

# T7 (final gates):
bash scripts/test.sh                                       # mvn 119/0/0 baseline
cd ai-runtime && ... uv run pytest -v                      # 44 + 12 = ~56 tests
cd frontend && bun run lint 2>&1 | tail -3                 # 32 baseline + 0 new
docker compose -f compose.yml -f compose.override.yml config > /dev/null && echo OK
```

**Playwright** (T7):
- `frontend/tests/psych_test_flow.spec.ts`
- Login → /user/test → input "心情低落、失眠、压力大" → answer 30 questions (mock 0-4 scores) → report view

---

## Known trade-offs (M3 cleanup backlog; not blocking merge)

1. **InMemorySaver** limits: ai-runtime process restart loses all thread state. M4 PostgresSaver fixes.
2. **`persist_test_record` is a stub**: M4 adds real Spring persistence via existing `TestRecordController`.
3. **`load_memory` is a stub**: M4 plugs pgvector long-term memory retrieval.
4. **`clarify_answer` never reached**: M3 sets `answer_ambiguous=False` always. M5 adds LLM-based ambiguity detection.
5. **Selection always 30 questions**: M5 could add dynamic count (per-dimension weight) or AI-generated questions.
6. **Embedding cold-start ~30s**: production should pre-warm + cache to disk. FastAPI lifespan startup hook.
7. **FAISS-cpu**: M4 may replace with pgvector for unified vector store.

---

## Out of scope (deferred to M4+)

- ❌ ConversationMeta + V5 migration (M4)
- ❌ pgvector long-term memory (M4)
- ❌ Real TestRecord persistence via `TestRecordController` (M4)
- ❌ Redis cancel / stop / pause / resume (M5)
- ❌ `useChat.ts` full rewrite + 5 other frontend files cleanup (M5)
- ❌ Per-user file ACL (M4)
- ❌ AI-generated dynamic questions (M+)
- ❌ Test-retest reliability (M+)
- ❌ Report i18n (M+)
- ❌ PDF export / print (M+)
