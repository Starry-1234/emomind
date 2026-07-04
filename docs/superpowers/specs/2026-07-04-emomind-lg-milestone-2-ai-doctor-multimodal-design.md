# M2 Design Spec — ai_doctor multimodal path

**Date:** 2026-07-04
**Branch:** `emomind-lg`
**Baseline:** `aa11af9` (M1 merged + Minor roll-up cleared)
**Status:** Design approved 2026-07-04; ready for writing-plans

---

## Goal

Extend the M1 text-only ai_doctor path to support multimodal inputs (audio, video, image, document) with a real file-upload pipeline. Users can upload one or more files alongside a text query, and the ai_doctor graph routes each file to the appropriate analysis node (vision API for images/audio/video, text extraction for documents, fusion synthesis for multi-type mixes).

**Non-goals (deferred to M3-M5):**

- Persistence (PostgresSaver, V5 ConversationMeta) — M4
- Long-term memory (extract_facts, write_long_term) — M4
- Real Redis-backed stop / pause / resume / regenerate-versions — M5
- `useChat.ts` full rewrite (other 5 frontend files still importing deleted `difyApi`) — M5
- Live video streaming, audio/video transcoding, OCR fallback, virus scan, file dedup, per-tier size limits
- Per-user file access control (M2 stores files globally per `file_id`; trust boundary is the `X-Internal-Token` between Spring and ai-runtime; per-user ACL lands with M4 persistence)

---

## Scope decisions (locked in brainstorming 2026-07-04)

| Decision | Choice |
|---|---|
| M2 scope | LLM + file upload (standard per `02-components.md`); no persistence/Redis |
| Image handling | Independent `analyze_image` node using Qwen3-Omni vision (not via `extract_doc` OCR) |
| Frontend scope | Full rewire of analysis modal (replace all 4 `TODO(M5)` markers) |
| Graph architecture | Parallel fan-out via LangGraph `Send` API + `fusion_analyze` for multi-type mixes |

---

## Architecture overview

```
                ┌─ analyze_text   ─┐
                ├─ analyze_audio  ─┤
classify_input ─┼─ analyze_video  ─┼─→ finalize → emit_response → END
                ├─ analyze_image  ─┤
                ├─ extract_doc → analyze_doc ─┤
                └─ (multimodal) → fusion_analyze ─┘
```

Per-layer changes:

| Layer | Add | Modify |
|---|---|---|
| **Spring** | `FileController` (`POST/GET /api/v1/ai/files`) | `AiProxyService.proxyFileUpload/proxyFileDownload` |
| **ai-runtime models** | `QwenOmniProvider` (wraps `langchain_openai.ChatOpenAI` with DashScope base URL) | `factory._PROVIDERS` registry gains `qwen3-omni` |
| **ai-runtime graphs** | 6 nodes: `analyze_audio`, `analyze_video`, `analyze_image`, `extract_doc`, `analyze_doc`, `fusion_analyze` | `classify_input` becomes a routing decision; `ai_doctor.py` uses `add_conditional_edges` + `Send` |
| **ai-runtime api** | `app/api/files.py` (`POST /v1/files/upload`, `GET /v1/files/{id}`) | `chat.py` passes `state.files` into the graph input |
| **ai-runtime prompts** | 5 new j2 templates under `app/prompts/ai_doctor/` | — |
| **ai-runtime memory** | `app/memory/cache.py` adds local-FS file storage (write/read/get-meta) | — |
| **frontend** | `langgraphApi.uploadFile`; `langgraphTypes.LangGraphFile` complete fields | `ai-doctor.tsx` 4 TODO(M5) → real implementation; state machine for upload progress |
| **compose** | Mount `LANGGRAPH_STORAGE_PATH` volume in `compose.yml` (named) and `compose.override.yml` (bind for dev) | — |

---

## Graph state machine + conditional edges

### State extension (`app/graphs/state.py`)

```python
class AiDoctorState(GraphState):
    # M1 fields (unchanged)
    modality: Optional[str]
    analyses: Optional[dict]     # {"text": "...", "audio": "...", "doc_text": "...", "image": "..."}
    analysis_result: Optional[str]

    # M2 additions
    files: Optional[list[dict]]  # [{"file_id": ..., "url": ..., "mime": ..., "size": ..., "name": ...}]
    fused: Optional[str]         # fusion_analyze output, used by finalize for multimodal
```

`modality` Literal becomes: `"text" | "audio" | "video" | "image" | "doc" | "multimodal"`.

### Routing decision table (`classify_input` rewrite)

| `state.files` | `state.modality` | Next node(s) |
|---|---|---|
| `[]` (no files, has messages) | `text` | `analyze_text` |
| 1× `image/*` | `image` | `analyze_image` |
| 1× `audio/*` | `audio` | `analyze_audio` |
| 1× `video/*` | `video` | `analyze_video` |
| 1× doc (pdf/docx/txt) | `doc` | `extract_doc` → `analyze_doc` |
| 2+ files of different types | `multimodal` | fan-out all per-modality nodes + `fusion_analyze` |

### `Send` API fan-out (parallel branches)

```python
# app/graphs/ai_doctor.py (M2 shape)
from langgraph.graph import END, START, StateGraph, Send

def _route_after_classify(state):
    files = state.get("files") or []
    modalities = _files_to_modalities(files)
    if len(modalities) == 1 and modalities[0] != "multimodal":
        return _modality_to_node(modalities[0])  # single node name

    # Multi-type: each modality is its own branch.
    # For the 'doc' branch, extract_doc and analyze_doc are chained as
    # a 2-step sequence in one Send (chained Send is supported).
    # All branches converge at finalize (or fusion_analyze first).
    sends = []
    for m in modalities:
        if m == "doc":
            # chain extract_doc -> analyze_doc
            sends.append(Send("extract_doc", {**state, "_next_after_extract": "analyze_doc"}))
        else:
            sends.append(Send(_modality_to_node(m), {"modality": m, "files": _files_of(files, m)}))
    # fusion_analyze is the synthesizer; it reads from state.analyses
    # after all branches have written their partial results.
    sends.append(Send("fusion_analyze", state))
    return sends

g.add_conditional_edges("classify_input", _route_after_classify, {...})
g.add_edge("extract_doc", "analyze_doc")
for n in ("analyze_text", "analyze_audio", "analyze_video", "analyze_image",
          "analyze_doc", "fusion_analyze"):
    g.add_edge(n, "finalize")
g.add_edge("finalize", "emit_response")
g.add_edge("emit_response", END)
```

**Routing note (ambiguity resolution):** In the single-doc case, `extract_doc → analyze_doc` is a sequential chain (one Send to `extract_doc`; conditional edge to `analyze_doc`; that node then routes to `finalize`). In the multimodal case, each modality is a separate Send branch; the doc branch is the same chain. `fusion_analyze` is dispatched as a separate Send that runs after all branches complete (LangGraph's `Send` API waits for all parallel branches to finish before continuing to the next node downstream of `classify_input`'s conditional edge).

**Multimodal convergence semantics:** `classify_input` returns a list of Sends; the graph's next "phase" begins only when all of them have produced their state updates. `fusion_analyze` reads `state.analyses` (which has all the per-modality partial results at that point) and emits `state["fused"]` for `finalize` to consume.

### `finalize` upgrade

```python
async def finalize(state):
    fused = state.get("fused")
    if fused:
        return {"analysis_result": fused}
    analyses = state.get("analyses") or {}
    modality = state.get("modality") or "text"
    text = analyses.get(modality) or next(iter(analyses.values()), "")
    return {"analysis_result": text}
```

---

## File upload flow + storage

### Lifecycle

```
1. User selects file (frontend)
2. POST /api/v1/ai/files (multipart, JWT auth)
3. Spring FileController: validate auth + size ≤ 50MB + mime whitelist
4. Spring AiProxyService.proxyFileUpload → POST /v1/files/upload (multipart, X-Internal-Token)
5. ai-runtime app/api/files.py:
   a. Validate size + mime (defense in depth)
   b. Generate file_id = uuid4().hex
   c. Write to ${LANGGRAPH_STORAGE_PATH}/<yyyy>/<mm>/<dd>/<file_id>.<ext>
   d. Append meta to JSONL: {file_id, user_id, mime, size, name, path, uploaded_at}
   e. Return {file_id, url, mime, size, name}
6. Spring returns ai-runtime response verbatim
7. Frontend adds file_id to langgraphApi.sendChatStream input.files
8. ai-runtime chat.py propagates state.files into graph
9. analyze nodes read file content from storage when needed
```

### Storage layout

```
${LANGGRAPH_STORAGE_PATH}/
├── 2026/
│   ├── 07/
│   │   ├── 04/
│   │   │   ├── a1b2c3d4e5f6...mp3
│   │   │   ├── f6e5d4c3b2a1...pdf
│   │   └── _meta/
│   │       └── 2026-07-04.jsonl    # one record per line
```

### MIME whitelist (ai-runtime enforces, Spring pre-validates)

- `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/mp4`, `audio/webm`
- `video/mp4`, `video/webm`, `video/quicktime`
- `application/pdf`, `text/plain`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### Limits

- 50MB per file (`LANGGRAPH_MAX_FILE_SIZE_MB`)
- Single multipart upload (no chunked/resumable — M2 scope; deferred to M3+)
- `file_id` = uuid4 hex (32 chars); server-side collision check (essentially zero probability)

### Download

`GET /v1/files/{file_id}` requires `X-Internal-Token`; reads meta + binary; returns file content with stored mime.

---

## Frontend changes

### `langgraphApi.uploadFile`

```ts
export async function uploadFile(file: File): Promise<LangGraphFile> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/v1/ai/files`, {
    method: "POST",
    credentials: "include",
    body: form,  // browser sets Content-Type with boundary
  });
  if (!res.ok) throw new Error(`File upload failed: ${res.status}`);
  return res.json();
}
```

### `LangGraphFile` (complete)

```ts
export interface LangGraphFile {
  file_id: string;
  url: string;
  mime: string;
  size: number;
  name?: string;
  category?: "image" | "audio" | "video" | "doc";
}
```

### `ai-doctor.tsx` 4 TODO replacements

| TODO | Replace with |
|---|---|
| `uploadFile()` stub (line ~35) | Real `apiUploadFile` call returning `LangGraphFile` |
| Dify-shaped `inputs` blob (line ~814) | `LangGraphMessage[]` with `files: LangGraphFile[]` |
| Dify callbacks shim (line ~839) | Direct `StreamCallbacks` mapping (no shim) |
| `inputs` variable + `void inputs` | Remove entirely; replaced by `messages` and `files` |

### Analysis modal state machine

```
idle → uploading (with progress 0-100) → analyzing (sub-stage: "audio" / "image" / "fusing") → complete → redirect
  ↘ error (with message)
```

Sub-stages driven by `onNodeStart` events from SSE:
- `extract_doc` / `analyze_doc` → "正在解析文档..."
- `analyze_audio` → "正在分析音频..."
- `analyze_video` → "正在分析视频..."
- `analyze_image` → "正在分析图片..."
- `fusion_analyze` → "正在融合多模态分析..."

### Compatibility

- Text-only `useChat()` path unchanged; multimodal is opt-in via the "分析" button
- Both entry points can coexist on the same page

---

## Test strategy

### Subagent-driven-development, 7 tasks (consolidated for context cohesion)

| # | Scope | Test approach | Est. effort |
|---|---|---|---|
| T1 | Spring `FileController` + `AiProxyService.proxyFileUpload/proxyFileDownload` | MockWebServer multipart; 401 unauth; 200 auth-pass | ~3h |
| T2 | ai-runtime `config.py` (Qwen + storage + max-file-size) + `QwenOmniProvider` + factory register | settings validation + FakeListChatModel retry | ~2h |
| T3 | `app/api/files.py` (upload/download) + `memory/cache.py` (local FS storage) + MIME whitelist | multipart; size limit; mime allowlist; storage write/read | ~4h |
| T4 | State extension + 6 new nodes + 5 j2 prompts + `ai_doctor.py` conditional edges + `Send` API fan-out (**largest task**) | per-node unit; routing decision table; parallel fan-out integration | ~6h |
| T5 | `app/api/chat.py` accepts `input.files` propagation + integration test | unit + end-to-end (uses T4's graph + T3's storage) | ~2h |
| T6 | frontend `langgraphApi.uploadFile` + `langgraphTypes.LangGraphFile` + `ai-doctor.tsx` 4 TODO replacements + state machine | `bun run lint` 0 new; type check; manual smoke | ~4h |
| T7 | Full verification + tag `m2-ai-doctor-multimodal` + Playwright multimodal spec | 4 gates; integration test of full text→multimodal switch | ~1h |

**Consolidation rationale (vs. 10-task split):** T2/T3 (config + provider) merged because the provider reads the new config fields; T4 (nodes + graph) merged because graph edges reference node signatures — splitting forces context rebuild between subagents. T5/T6 (langgraphApi + ai-doctor) merged because ai-doctor.tsx consumes the uploadFile helper signature. Largest task T4 is ~6h, within single subagent capacity.

### Per-task verify commands

```bash
# Java (T1)
cd backend-sb && mvn -q test -Dtest=FileControllerTest,FileControllerAuthTest

# Python (T2-T5)
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key \
  LANGGRAPH_INTERNAL_TOKEN=changeme-internal-token-must-be-32-chars-long \
  uv run pytest tests/<path>::test_name -v

# Frontend (T6)
cd frontend && bun run lint
```

### Full verification gates (T7)

```bash
bash scripts/test.sh      # mvn 119/0/0 (4 V4MigrationTest pre-existing)
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key \
  LANGGRAPH_INTERNAL_TOKEN=changeme-internal-token-must-be-32-chars-long \
  uv run pytest -v         # expect +5-8 new tests
cd frontend && bun run lint   # 0 new
docker compose -f compose.yml -f compose.override.yml config > /dev/null
```

### Risk register

| Risk | Mitigation |
|---|---|
| LangGraph `Send` API behavior surprise | T6 in isolation; write failing fan-out test first, learn API, then implement |
| DashScope Qwen3-Omni OpenAI compat drift | T2 uses `FakeListChatModel`; real call deferred to T7 smoke |
| Multipart Spring→ai-runtime forwarding | T1 unit-tested with MockWebServer; possibly need `MultipartBodyBuilder` |
| Concurrent file write collision | UUIDv4 names; no locking needed |
| 50MB request timeout | Spring + ai-runtime both set generous read timeout |

### Reuse M1 lessons

- Conftest autouse `_set_minimax_env` extended to set `_set_qwen_env` (or merged)
- `langgraphApi.uploadFile` follows `fetch + credentials: 'include'` pattern from T7
- Integration tests use `FakeListChatModel`; no real LLM calls in CI

### Not writing

- Real Qwen3-Omni unit tests (cost, network, CI slow)
- Storage concurrent stress tests
- E2E real-file upload (Playwright in CI; large files risky)

---

## Configuration additions

```env
# .env.example additions for M2
LANGGRAPH_QWEN_API_KEY=your-qwen-api-key
LANGGRAPH_QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LANGGRAPH_QWEN_MODEL=qwen3-omni
LANGGRAPH_MAX_FILE_SIZE_MB=50
LANGGRAPH_STORAGE_PATH=/var/lib/emomind/files   # already in M0
```

```yaml
# compose.override.yml addition
ai-runtime:
  volumes:
    - ./ai-runtime-files:/var/lib/emomind/files
```

```yaml
# .github/workflows/ai-runtime.yml addition
env:
  LANGGRAPH_QWEN_API_KEY: test-key   # add to existing env block
```

---

## Rollout + rollback

- M2 merges `emomind-lg` → `main`; tag `m2-ai-doctor-multimodal` at the milestone commit
- User pushes manually (same as M1)
- Frontend: text path still default; multimodal is opt-in via "分析" button — no traffic cut required
- **Rollback:** revert to tag `m1-ai-doctor-text`. Spring's `FileController` won't be hit (no client calls it). ai-runtime handles missing `files` field by routing to text-only. Zero-downtime rollback.

---

## Known technical debt (logged, not fixed in M2)

- File metadata in JSONL log; complex queries weak → migrate to Postgres in M4
- 50MB hard limit; per-tier limit is future work
- No virus scan; uploaded files go straight to Qwen3-Omni
- No file dedup; same file uploaded twice → two file_ids
- Audio/video format coverage assumes Qwen3-Omni supports user's encoding; no transcoding
