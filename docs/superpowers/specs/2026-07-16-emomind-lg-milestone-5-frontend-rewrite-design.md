# M5 Design Spec — Frontend rewrite + Redis cancel + chat history UI

**Date:** 2026-07-16
**Branch:** `emomind-lg`
**Baseline:** `39ea4e6` (M4 merged to main; emomind-lg at `1e2c844` = m4-persistence chore)
**Status:** Design approved 2026-07-16; ready for writing-plans

---

## Goal

The final milestone of the EmoMind LangGraph port. M5 retires the Dify client from the frontend, replaces it with a unified `useChat.ts` built on `langgraphApi.sendChatStream` (already in place since M2), and adds the production features the prior milestones stubbed: Redis-backed cancel/pause/resume/regenerate-versions, V5-backed chat history UI, and the M3 streaming-gap fix. After M5, the frontend has zero `difyApi` references and a single, coherent `useChat` hook driving all graph flows (ai-doctor and psych-test).

---

## Scope decisions (locked in brainstorming 2026-07-16)

| Decision | Choice |
|---|---|
| M5 scope | Full M5: useChat.ts rewrite + 5-file cleanup + Redis cancel/pause/resume/regenerate + V5 chat history UI + M3 streaming gap fix + M4 cleanup items |
| Chat history data | V5 REST endpoint `GET /api/v1/ai/conversations?user_id=X&graph=Y` (M4 T1's `ConversationMetaController`); React Query for client cache |
| `useChat.ts` shape | Single hook owning SSE state machine; reused by ai-doctor and psych-test (intent passed in by caller) |
| Cancel signal | Frontend `AbortController` closes SSE; ai-runtime reads `is_cancelled(thread_id)` from Redis between nodes (set on SSE close + explicit `POST /v1/conversations/{id}/cancel` for "Stop" button) |
| Regenerate-versions | Per-message array of versions; "regenerate" creates a new attempt under the same thread_id with a `version` query param on `/v1/chat`; backend keeps the last N versions in graph state (default 3) |
| `usePsychologicalTest.ts` | Refactor to use the new `useChat` with `intent="start_test"`; tests get routed to `build_psych_test_graph` |
| `ConversationContext.tsx` | New role: holds current `userId` + `threadId` (per-graph); chat history list; selected conversation. Provider pattern preserved. |
| `routes/_admin-layout/chat-history.tsx` | Rewrite to use V5 REST + React Query (replace Dify list). |
| `routes/user/index.tsx` | Update to import new `useChat`; remove Dify. |
| M3 streaming gap fix | Add `state.pending_question` + `state.questions` to SSE `workflow_event` (per spec 06-components); generate_next_question emits the event so frontend knows what to render. |
| M4 minor #1 | `extract_facts` runs every 3rd turn (not every turn) — sampling to cap LLM cost. |
| M4 minor #2 | `proxyFileUpload` and `proxyFileList` validate `X-User-Id` matches JWT principal (file ACL on upload + list, not just download). |
| M4 minor #3 | `clarify_answer` runs when LLM-graded `analyze_answer` returns a `confidence < 0.6` flag (new field in LLM response). |

---

## Architecture (per layer)

### Frontend (`frontend/src/`)

```
src/
├── services/
│   ├── langgraphApi.ts            (M2; unchanged — already supports ai-doctor + psych-test)
│   ├── conversationApi.ts          NEW — wraps V5 REST (POST/GET/list /conversations)
│   └── cancelApi.ts               NEW — POST /v1/conversations/{threadId}/cancel (ai-runtime direct)
├── hooks/
│   ├── useChat.ts                 REWRITE (1458 lines → ~400 lines) — single hook, SSE state machine, versions, cancel/pause/resume
│   └── useChatHistory.ts          NEW — React Query wrapper over conversationApi
├── contexts/
│   └── ConversationContext.tsx    REWRITE — current userId + selected threadId; chat history list; selected conversation
├── routes/
│   ├── _admin-layout/
│   │   └── chat-history.tsx        REWRITE — useChatHistory + render
│   ├── user/
│   │   ├── index.tsx              UPDATE — useChat(intent="start_test" for test page) + ConversationContext
│   │   ├── chat/$sessionId.tsx    UPDATE — drop difyApi, use new useChat
│   │   └── test/index.tsx         (M3 wrote; verify uses new useChat)
│   └── hooks/usePsychologicalTest.ts  REWRITE — use new useChat(intent="start_test")
├── lib/
│   ├── throttledMessagesUpdater.ts  (M1; may simplify under new useChat)
│   └── versions.ts                NEW — version-array helpers
└── pages/
    └── (any new pages for chat history browser if needed)
```

**`useChat.ts` shape (after rewrite)** — the 1458-line monolith becomes ~400 lines, focused on a single SSE state machine:

```typescript
interface UseChatOptions {
  graph: "ai-doctor" | "psych-test";
  threadId: string;
  onConversationMetaUpdate?: (meta: ConversationMeta) => void;
}
interface UseChatReturn {
  messages: Message[];            // with version[] + currentVersion
  isStreaming: boolean;
  isPaused: boolean;
  error: Error | null;
  currentVersion: number;
  send: (text: string, files?: File[]) => Promise<void>;
  stop: () => void;             // aborts SSE; calls cancelApi
  pause: () => void;            // sets pause flag; backend honors via Redis
  resume: () => void;
  regenerate: () => Promise<void>;
  switchVersion: (v: number) => void;
}
```

The hook owns one `EventSource` (via `fetch` + `ReadableStream`, since `EventSource` can't set custom headers) and one `AbortController` per active stream. State transitions are explicit:

```
idle → streaming → (paused) → (resumed) → streaming → complete | error
                  ↓
              cancelled
```

### Backend Spring (`backend-sb/`)

```
src/main/java/com/emomind/
├── controller/
│   ├── AiController.java            UPDATE — adds POST /v1/ai/conversations/{threadId}/cancel
│   │                               (proxies to ai-runtime POST /v1/conversations/{id}/cancel)
│   └── ConversationMetaController.java (M4 T1; unchanged — already has the right endpoints)
├── service/
│   └── AiProxyService.java          UPDATE — gains proxyCancel(threadId) + proxyConversationList
│                                   + proxyFileList (with ACL on list)
```

### Backend ai-runtime (`ai-runtime/`)

```
app/
├── api/
│   ├── chat.py                     UPDATE — graph_state.event emits workflow_event with
│   │                               state.pending_question (M3 streaming fix)
│   └── conversations.py            NEW — POST /v1/conversations/{threadId}/cancel
├── graphs/nodes/
│   ├── generate_next_question.py   UPDATE — emits workflow_event with state.pending_question
│   ├── analyze_answer.py           UPDATE — adds confidence field to LLM response
│   ├── clarify_answer.py           UPDATE — runs when confidence < 0.6 (M4 minor fix)
│   └── _extract_facts.py           (M4; UPDATE — sample every 3rd turn)
├── memory/
│   ├── cache.py                    (M0; UPDATE — add set_cancel_flag + is_cancelled helpers)
│   └── long_term.py                (M4; unchanged)
└── graphs/
    ├── ai_doctor.py                (M4; unchanged)
    └── psych_test.py               (M4; unchanged)
```

---

## File Structure

### New files

```
backend-sb/src/main/java/com/emomind/controller/ConversationMetaController.java (M4 T1; unchanged)
backend-sb/src/main/java/com/emomind/service/AiProxyService.java (UPDATE)
backend-sb/src/test/java/com/emomind/service/AiProxyServiceCancelTest.java (NEW)

ai-runtime/app/api/conversations.py
ai-runtime/app/graphs/nodes/clarify_answer.py (UPDATE only)
ai-runtime/tests/integration/test_chat_cancel.py
ai-runtime/tests/unit/test_extract_facts_sampling.py

frontend/src/services/conversationApi.ts
frontend/src/services/cancelApi.ts
frontend/src/hooks/useChat.ts (REWRITE — replaces 1458-line monolith)
frontend/src/hooks/useChatHistory.ts
frontend/src/lib/versions.ts
frontend/src/lib/localStorage.ts (M3 wrote; UPDATE if needed)
frontend/src/routes/chat-history/index.tsx (NEW — chat history browser page)
frontend/src/routes/chat-history/$threadId.tsx (NEW — single conversation view)
frontend/tests/chat_cancel.spec.ts
frontend/tests/chat_history.spec.ts
frontend/tests/regenerate_versions.spec.ts
```

### Modified files

```
backend-sb/src/main/java/com/emomind/controller/AiController.java
backend-sb/src/main/java/com/emomind/controller/FileController.java (M4 T2; UPDATE — proxyFileList adds ACL)
backend-sb/src/main/java/com/emomind/service/AiProxyService.java
backend-sb/pom.xml (no change unless new dep)

ai-runtime/app/api/chat.py
ai-runtime/app/graphs/nodes/generate_next_question.py
ai-runtime/app/graphs/nodes/analyze_answer.py
ai-runtime/app/graphs/nodes/clarify_answer.py
ai-runtime/app/graphs/nodes/_extract_facts.py
ai-runtime/app/memory/cache.py
ai-runtime/pyproject.toml (no change unless new dep)

frontend/src/services/langgraphApi.ts (M2; may add cancel support — or use separate cancelApi)
frontend/src/contexts/ConversationContext.tsx (REWRITE)
frontend/src/hooks/usePsychologicalTest.ts (REWRITE)
frontend/src/routes/user/index.tsx (UPDATE)
frontend/src/routes/user/chat/$sessionId.tsx (UPDATE)
frontend/src/routes/_admin-layout/chat-history.tsx (REWRITE)
frontend/src/lib/throttledMessagesUpdater.ts (M1; UPDATE or remove)

.github/workflows/ci.yml (UPDATE — if frontend CI changes)
```

### Removed files (zero `difyApi` references after M5)

```
frontend/src/services/difyApi.ts (M1; DELETE in M5)
```

---

## Component contracts

### `useChat.ts` (after rewrite, ~400 lines)

Public API (TypeScript):

```typescript
type Graph = "ai-doctor" | "psych-test";

interface UseChatOptions {
  graph: Graph;
  threadId: string | null;        // null = generate on first send
  userId: string;
  conversationId?: string | null; // V5 ConversationMeta.id; set on creation
  onConversationCreated?: (id: string) => void;
}

interface Message {
  id: string;                     // client-generated UUID
  role: "user" | "assistant" | "system";
  content: string;
  files?: File[];
  version: number;                // increments per regenerate
  isStreaming: boolean;
  isPaused: boolean;
  createdAt: number;               // epoch ms
}

interface UseChatReturn {
  messages: Message[];
  currentVersion: number;
  isStreaming: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  error: Error | null;
  send: (text: string, options?: { files?: File[] }) => Promise<void>;
  stop: () => void;               // AbortController.abort() + cancelApi
  pause: () => void;              // sets paused=true; backend keeps streaming but UI doesn't render
  resume: () => void;             // continues from paused state
  regenerate: () => Promise<void>;
  switchVersion: (v: number) => void;
}

export function useChat(options: UseChatOptions): UseChatReturn;
```

State management: a single `useReducer` with explicit actions (`SEND`, `STREAM_START`, `STREAM_TOKEN`, `STREAM_DONE`, `STREAM_ERROR`, `STOP`, `PAUSE`, `RESUME`, `REGENERATE`, `SWITCH_VERSION`). Reducer is tested in isolation.

### `useChatHistory.ts` (NEW, ~50 lines)

```typescript
interface UseChatHistoryReturn {
  conversations: ConversationMeta[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
  create: (graph: Graph, title?: string) => Promise<ConversationMeta>;
  remove: (threadId: string) => Promise<void>;
}
```

Wraps `conversationApi` (V5 REST) via React Query (`useQuery` + `useMutation`).

### `ai-runtime/app/api/conversations.py` (NEW, ~80 lines)

```python
@router.post("/v1/conversations/{thread_id}/cancel")
async def cancel_conversation(thread_id: str) -> dict:
    """Set Redis cancel flag; graph will check between nodes."""
    await set_cancel_flag(thread_id)
    return {"thread_id": thread_id, "cancelled": True}
```

### `ai-runtime/app/memory/cache.py` (UPDATE)

Add helpers:

```python
async def set_cancel_flag(thread_id: str, ttl_seconds: int = 600) -> None:
    """Set Redis flag with TTL. ai-runtime worker reads this between graph nodes."""
    await redis_client.setex(f"cancel:{thread_id}", ttl_seconds, "1")

async def is_cancelled(thread_id: str) -> bool:
    val = await redis_client.get(f"cancel:{thread_id}")
    return val is not None

async def clear_cancel_flag(thread_id: str) -> None:
    await redis_client.delete(f"cancel:{thread_id}")
```

### `ai-runtime/app/graphs/chat.py` (UPDATE)

SSE event types (additions to M2 set):

```python
# workflow_event for state.pending_question (M3 streaming fix)
yield format_sse_event("workflow_event", {
    "type": "question_ready",
    "question": state["pending_question"],   # full dict
    "thread_id": state.get("thread_id"),
})
```

`analyze_answer` LLM call now also returns a `confidence` field (0-1); if `< 0.6`, the graph routes to `clarify_answer` (M4 minor fix).

`_extract_facts` runs every 3rd turn:

```python
if state.get("messages_answered_count", 0) % 3 == 0:
    asyncio.create_task(extract_facts_and_persist(state))
```

### `ai-runtime/app/graphs/nodes/generate_next_question.py` (UPDATE)

When a new question is set, emit a `workflow_event` so the frontend can render the next question without waiting for `message_end`.

---

## SSE event types (M5 additions)

| Event | Trigger | Payload |
|---|---|---|
| `workflow_event` (M2 baseline) | various | `{type, ...}` |
| `workflow_event: question_ready` (NEW) | `generate_next_question` writes `state.pending_question` | `{type: "question_ready", question, thread_id}` |
| `workflow_event: clarify_request` (NEW) | `clarify_answer` runs (M4 minor fix path) | `{type: "clarify_request", question, thread_id}` |
| `message_end.version` (NEW) | `message_end` event | includes `version` field in payload |
| `error.code` (UPDATE) | M3 was generic; M5 adds `code: "CANCELLED"`, `code: "PAUSED"`, `code: "TIMEOUT"` |

---

## Test strategy

```bash
# Backend
cd backend-sb && bash scripts/test.sh

# ai-runtime
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key \
  LANGGRAPH_EMBEDDING_API_KEY=test-key LANGGRAPH_INTERNAL_TOKEN=changeme-internal-token-must-be-32-chars-long \
  uv run pytest

# Frontend
cd frontend && bun run lint && bunx tsc --noEmit
```

### New tests

| Test | What it asserts |
|---|---|
| `test_chat_cancel.py` (ai-runtime integration) | Redis flag set on cancel; graph exits early; final SSE frame carries `error.code="CANCELLED"` |
| `test_extract_facts_sampling.py` (ai-runtime unit) | Every 3rd turn triggers `extract_facts_and_persist`; others skip |
| `AiProxyServiceCancelTest` (backend) | proxyCancel sends correct headers + path |
| `chat_cancel.spec.ts` (Playwright) | Stop button → aborts stream → backend has Redis flag |
| `chat_history.spec.ts` (Playwright) | /chat-history page lists conversations from V5 REST |
| `regenerate_versions.spec.ts` (Playwright) | Regenerate button creates new version; old version preserved |

---

## Verification (4 gates)

Same as M1-M4:

- `bash scripts/test.sh` (mvn + pgvector-test)
- `uv run pytest` (ai-runtime)
- `bun run lint` (frontend)
- `docker compose -f compose.yml -f compose.override.yml config`

---

## Known M5 cleanup backlog (logged, not blocking)

1. **`useChat.ts` 1458 lines → ~400 lines is the headline win.** All Dify-specific code removed; no behavioral change visible to the user beyond the production features.
2. **`throttledMessagesUpdater.ts` may be removed** if the rewrite makes it unnecessary (single SSE state machine handles streaming directly).
3. **Versions are kept in graph state for 3 turns** (LRU eviction). Memory cost is bounded; not a concern.
4. **M3 streaming fix (workflow_event)** may surface as a transient "no message yet" state in some frontend paths; the spec covers this via the `question_ready` event.

---

## Out of scope (deferred to M6+)

- ❌ Mobile app (no plan)
- ❌ Voice input (no plan)
- ❌ Multi-user chat rooms (no plan)
- ❌ Real-time collaboration (no plan)
- ❌ AIGC-style report generation (no plan)
- ❌ i18n beyond zh-CN (no plan)

---

## Task ordering (for writing-plans)

1. **T1** Backend: `ai-runtime/app/api/conversations.py` (cancel endpoint) + `cache.py` (Redis cancel helpers) + `chat.py` workflow_event (M3 fix)
2. **T2** Backend: `ai-runtime` graph changes — `analyze_answer` confidence field + `clarify_answer` routing; `_extract_facts` every 3rd turn; `generate_next_question` workflow_event
3. **T3** Backend: `ai-runtime` integration tests — `test_chat_cancel.py`, `test_extract_facts_sampling.py`
4. **T4** Backend: Spring — `AiController.cancel` proxy + `AiProxyService.proxyCancel` + `proxyFileList` with ACL; `FileController` file-list endpoint; `AiProxyServiceCancelTest`
5. **T5** Frontend: `services/conversationApi.ts` (V5 REST wrapper) + `services/cancelApi.ts` (POST cancel)
6. **T6** Frontend: rewrite `hooks/useChat.ts` (the 1458 → ~400 lines monolith) — single SSE state machine, versions, cancel/pause/resume/regenerate
7. **T7** Frontend: rewrite `contexts/ConversationContext.tsx` (current userId/threadId + history list) + `hooks/useChatHistory.ts`
8. **T8** Frontend: rewrite `hooks/usePsychologicalTest.ts` (use new useChat with intent="start_test") + `routes/user/chat/$sessionId.tsx` (drop difyApi) + `routes/user/index.tsx` (update import) + `routes/_admin-layout/chat-history.tsx` (rewrite with V5 REST)
9. **T9** Frontend: delete `services/difyApi.ts` + Playwright specs (`chat_cancel.spec.ts`, `chat_history.spec.ts`, `regenerate_versions.spec.ts`)
10. **T10** Verification + tag `m5-frontend-rewrite` + Playwright spec for the new useChat E2E

10 tasks. ~5-6 days work (largest is T6 — rewriting 1458 lines into 400).

> Note: T10 makes M5 the LAST milestone. After M5, the project has zero `difyApi` references and all 5 milestones are complete.
