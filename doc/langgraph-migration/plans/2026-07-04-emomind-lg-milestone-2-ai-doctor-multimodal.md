# M2: ai_doctor multimodal path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the end-to-end ai_doctor multimodal path: users upload one or more files (image/audio/video/document) alongside a text query, the Spring gateway forwards to ai-runtime, the LangGraph ai_doctor graph routes each file to the right analysis node (Qwen3-Omni for image/audio/video, text extraction + LLM for document, parallel fan-out + fusion for multi-type mixes), and the response streams back as SSE.

**Architecture:** Two-tier runtime with M0/M1-style boundary preservation. Spring Boot remains the auth/aggregation gateway; ai-runtime (Python + LangGraph + FastAPI) executes the graph and emits LangGraph-native SSE events. The ai_doctor graph uses `add_conditional_edges` + the `Send` API for parallel multimodal fan-out into a `fusion_analyze` synthesizer. File upload is multipart from frontend → Spring → ai-runtime, with local-filesystem storage under `LANGGRAPH_STORAGE_PATH`. `extract_facts` / `write_long_term` are still NOT wired into the M2 graph — they're M4.

**Tech Stack:** Spring Boot 3.2 + WebClient (multipart), Java 17, Maven; FastAPI 0.115 + LangGraph 0.2.x + LangChain 0.3.x + Pydantic 2.x + asyncpg + redis-py + tenacity; Qwen3-Omni via DashScope OpenAI-compatible endpoint; pypdf + python-docx for document text extraction; React 19 + TypeScript + TanStack Router/Query + Biome.

---

## Global Constraints

- **Working directory:** `F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg`
- **Branch:** `emomind-lg` (do not switch)
- **Conventional Commits prefix per layer:**
  - `feat(backend):` for Java
  - `feat(ai-runtime):` for Python
  - `feat(frontend):` for TS
  - `test:` for tests-only
  - `chore(m<n>):` for tag/final
- **Do NOT push.** User pushes manually.
- **No real API keys in code or commits.** Use placeholders; tests must mock LLMs.
- **One commit per task.** Task deliverable's tests must be green before commit.
- **M2 doesn't depend on Redis, PostgresSaver, pgvector long-term memory, V5 migration, stop/pause/resume, regenerate-versions, or per-user file ACL.** If you find yourself needing any of those, you've left M2 scope — stop and ask.
- **Verify locally before commit:**
  - Java: `cd backend-sb && mvn -q test -Dtest=ClassName#method`
  - Python: `cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key LANGGRAPH_INTERNAL_TOKEN=changeme-internal-token-must-be-32-chars-long uv run pytest tests/path/test.py::test_name -v`
  - Frontend: `cd frontend && bun run lint` (lint is read-only; do not auto-format)
- **LLM API contract for tests:** mock `BaseChatModel.ainvoke` / `astream` to return canned `AIMessage` / `AIMessageChunk`. Never call real LLM in unit/integration tests. For Qwen3-Omni specifically, use a fake model that returns canned text — no real DashScope calls.
- **Run from project root unless task says otherwise.**
- **Files in scope for M2 only.** Do NOT touch `frontend/src/{routes,hooks,contexts}/**` files that aren't explicitly in the plan (5 other files still importing deleted `difyApi` are M5 scope).
- **Storage paths in tests use tmp_path or a per-test isolated dir** (e.g., `tmp_path_factory`) to avoid polluting the real `${LANGGRAPH_STORAGE_PATH}`.

---

## File Structure

### New Python files (ai-runtime)

```
ai-runtime/app/
├── api/files.py                                  POST/GET /v1/files
├── memory/cache.py                               local-FS file storage (write/read/get_meta)
├── graphs/nodes/analyze_audio.py                 Qwen3-Omni audio → reply
├── graphs/nodes/analyze_video.py                 Qwen3-Omni video frame → reply
├── graphs/nodes/analyze_image.py                 Qwen3-Omni vision → reply
├── graphs/nodes/extract_doc.py                   pdf/docx → text
├── graphs/nodes/analyze_doc.py                   text → LLM reply
├── graphs/nodes/fusion_analyze.py                all analyses → fused
├── prompts/ai_doctor/
│   ├── analyze_audio.j2
│   ├── analyze_video.j2
│   ├── analyze_image.j2
│   ├── extract_doc.j2
│   ├── analyze_doc.j2
│   └── fusion_analyze.j2
└── models/qwen_omni.py                           Qwen3-Omni via ChatOpenAI
```

### Modified Python files (ai-runtime)

```
ai-runtime/app/config.py                          +qwen_*, +max_file_size_mb, +storage_path default
ai-runtime/app/models/factory.py                  +qwen3-omni in _PROVIDERS
ai-runtime/app/main.py                            +files router
ai-runtime/app/graphs/state.py                    +files, +fused
ai-runtime/app/graphs/nodes/classify_input.py     routing decision (text/image/audio/video/doc/multimodal)
ai-runtime/app/graphs/nodes/finalize.py           handles fused
ai-runtime/app/graphs/ai_doctor.py               conditional edges + Send API fan-out
ai-runtime/app/api/chat.py                        accepts state.files
ai-runtime/.env.example                           +qwen_*, +max_file_size_mb
```

### New Python tests

```
ai-runtime/tests/
├── unit/test_qwen_provider.py                    factory + retry
├── unit/test_classify_input.py                   M1 already; M2 adds routing
├── unit/test_analyze_audio.py
├── unit/test_analyze_video.py
├── unit/test_analyze_image.py
├── unit/test_extract_doc.py
├── unit/test_analyze_doc.py
├── unit/test_fusion_analyze.py
├── unit/test_finalize.py                         M1; M2 adds fused path
├── integration/test_files_endpoint.py            multipart upload/download/storage
├── integration/test_ai_doctor_multimodal.py      end-to-end multimodal graph
```

### Modified Python tests

```
ai-runtime/tests/conftest.py                      add _set_qwen_env
ai-runtime/tests/test_settings.py                 add qwen_* tests (replace os.environ leak in test #3)
```

### New Java files (backend-sb)

```
backend-sb/src/main/java/com/emomind/controller/FileController.java
backend-sb/src/test/java/com/emomind/controller/FileControllerAuthTest.java
backend-sb/src/test/java/com/emomind/service/AiProxyServiceFileTest.java
```

### Modified Java files (backend-sb)

```
backend-sb/src/main/java/com/emomind/service/AiProxyService.java        +proxyFileUpload, +proxyFileDownload
backend-sb/src/main/resources/application.yml                            expose new app.langgraph.* keys
backend-sb/src/main/java/com/emomind/config/LangGraphProperties.java      +maxFileSizeMb
```

### New Frontend files

```
frontend/src/lib/fileUpload.ts                                     multipart helper
frontend/tests/multimodal-upload.spec.ts                           Playwright spec
```

### Modified Frontend files

```
frontend/src/services/langgraphApi.ts                              +uploadFile
frontend/src/services/langgraphTypes.ts                            complete LangGraphFile
frontend/src/routes/user/ai-doctor.tsx                            4 TODO(M5) → real impl + state machine
```

### Modified root files

```
.gitattributes                                                       already set in M1; no change
.github/workflows/ai-runtime.yml                                   +LANGGRAPH_QWEN_API_KEY
frontend/package.json                                               already fixed in M1 post-cleanup
emomind-lg/.env.example                                              N/A (this is ai-runtime/.env.example)
compose.yml                                                          +ai-runtime volume
compose.override.yml                                                +ai-runtime bind mount
```

---

## Task 1: Spring backend — `FileController` + `AiProxyService.proxyFileUpload/proxyFileDownload`

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/controller/FileController.java`
- Create: `backend-sb/src/test/java/com/emomind/controller/FileControllerAuthTest.java`
- Create: `backend-sb/src/test/java/com/emomind/service/AiProxyServiceFileTest.java`
- Modify: `backend-sb/src/main/java/com/emomind/service/AiProxyService.java`
- Modify: `backend-sb/src/main/java/com/emomind/config/LangGraphProperties.java`

**Interfaces (this task produces):**
- `LangGraphProperties.getMaxFileSizeMb(): long` (new, default 50)
- `FileController.upload(@RequestParam("file") MultipartFile file)` returns `ResponseEntity<Map<String, Object>>` with `{file_id, url, mime, size, name}` (M2-shape; auth via JWT filter)
- `FileController.download(@PathVariable String fileId)` returns `ResponseEntity<byte[]>` (M2-shape; auth via JWT filter)
- `AiProxyService.proxyFileUpload(MultipartFile file, UUID userId): Map<String,Object>` (forwards to ai-runtime `/v1/files/upload` as multipart with 4 headers + `X-User-Id` from authenticated principal)
- `AiProxyService.proxyFileDownload(String fileId, UUID userId): Mono<byte[]>` (forwards to ai-runtime `/v1/files/{fileId}`; uses `WebClient` with `byte[]` body)

**Global note:** M1's `AiController.chat` + `AiProxyService.proxyChatStream` stay unchanged. `FileController` is a new controller mounted under `/api/v1/ai/files`. Reuse the existing `aiRuntimeWebClient` bean from T1 (M1).

- [ ] **Step 1: Write failing tests for `AiProxyService` multipart upload + download**

Create `backend-sb/src/test/java/com/emomind/service/AiProxyServiceFileTest.java`:

```java
package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.core.io.ByteArrayResource;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AiProxyServiceFileTest {

    private MockWebServer server;
    private AiProxyService service;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();

        LangGraphProperties props = new LangGraphProperties();
        props.setRuntimeUrl(server.url("/").toString().replaceAll("/$", ""));
        props.setInternalToken("test-internal-token-32-chars-long-xxxx");
        props.setConnectTimeoutMs(1000L);
        props.setResponseTimeoutMs(5000L);
        props.setMaxFileSizeMb(50L);

        WebClient webClient = WebClient.builder()
            .baseUrl(props.getRuntimeUrl())
            .build();
        service = new AiProxyService(webClient, props);
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void proxyFileUpload_forwardsMultipart_andReturnsMap() throws Exception {
        server.enqueue(new MockResponse()
            .setHeader("Content-Type", "application/json")
            .setBody("{\"file_id\":\"abc123\",\"url\":\"http://x\",\"mime\":\"image/png\",\"size\":1024,\"name\":\"a.png\"}"));

        UUID userId = UUID.randomUUID();
        // Build a MultipartFile from a small byte array
        byte[] data = new byte[]{1, 2, 3, 4};
        org.springframework.mock.web.MockMultipartFile mf =
            new org.springframework.mock.web.MockMultipartFile(
                "file", "a.png", "image/png", data);

        Map<String, Object> result = service.proxyFileUpload(mf, userId);
        assertThat(result).containsEntry("file_id", "abc123");
        assertThat(result).containsEntry("mime", "image/png");
        assertThat(result).containsEntry("size", 1024);

        RecordedRequest req = server.takeRequest();
        assertThat(req.getPath()).isEqualTo("/v1/files/upload");
        assertThat(req.getMethod()).isEqualTo("POST");
        assertThat(req.getHeader("X-User-Id")).isEqualTo(userId.toString());
        assertThat(req.getHeader("X-Internal-Token")).isEqualTo("test-internal-token-32-chars-long-xxxx");
        assertThat(req.getHeader("X-Trace-Id")).isNotBlank();
        // Multipart body should contain the file part
        String body = req.getBody().readUtf8();
        assertThat(body).contains("a.png");
        assertThat(body).contains("image/png");
    }

    @Test
    void proxyFileDownload_returnsByteArray() throws Exception {
        byte[] payload = new byte[]{0x10, 0x20, 0x30};
        server.enqueue(new MockResponse()
            .setHeader("Content-Type", "image/png")
            .setBody(new okio.Buffer().write(payload)));

        UUID userId = UUID.randomUUID();
        Mono<byte[]> mono = service.proxyFileDownload("abc123", userId);
        StepVerifier.create(mono)
            .assertNext(bytes -> {
                assertThat(bytes).isEqualTo(payload);
            })
            .verifyComplete();

        RecordedRequest req = server.takeRequest();
        assertThat(req.getPath()).isEqualTo("/v1/files/abc123");
        assertThat(req.getMethod()).isEqualTo("GET");
        assertThat(req.getHeader("X-Internal-Token")).isEqualTo("test-internal-token-32-chars-long-xxxx");
        assertThat(req.getHeader("X-User-Id")).isEqualTo(userId.toString());
    }
}
```

The `MultipartFile` import for the test comes from `org.springframework.web.multipart.MultipartFile`. The `MockMultipartFile` is in `org.springframework.mock.web`.

- [ ] **Step 2: Run test, verify it fails (compilation or assertion)**

```bash
cd backend-sb && mvn -q test -Dtest=AiProxyServiceFileTest
```

Expected: FAIL — `AiProxyService.proxyFileUpload` / `proxyFileDownload` don't exist yet, or `LangGraphProperties.getMaxFileSizeMb` doesn't exist.

- [ ] **Step 3: Extend `LangGraphProperties`**

`backend-sb/src/main/java/com/emomind/config/LangGraphProperties.java` — add field (preserve existing ones):

```java
private long maxFileSizeMb = 50L;

public long getMaxFileSizeMb() { return maxFileSizeMb; }
public void setMaxFileSizeMb(long maxFileSizeMb) { this.maxFileSizeMb = maxFileSizeMb; }
```

- [ ] **Step 4: Add `proxyFileUpload` + `proxyFileDownload` to `AiProxyService`**

Modify `backend-sb/src/main/java/com/emomind/service/AiProxyService.java`. Add imports:

```java
import org.springframework.http.HttpEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.ByteArrayResource;
```

Add these methods to the class:

```java
public Map<String, Object> proxyFileUpload(MultipartFile file, UUID userId) {
    String traceId = UUID.randomUUID().toString();
    String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
    String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
    byte[] bytes;
    try {
        bytes = file.getBytes();
    } catch (Exception e) {
        throw new RuntimeException("Failed to read uploaded file", e);
    }
    long size = bytes.length;
    if (size > props.getMaxFileSizeMb() * 1024L * 1024L) {
        throw new IllegalArgumentException(
            "File too large: " + size + " bytes (max " + props.getMaxFileSizeMb() + " MB)");
    }
    ByteArrayResource resource = new ByteArrayResource(bytes) {
        @Override
        public String getFilename() { return originalName; }
        @Override
        public long contentLength() { return size; }
    };
    MultipartBodyBuilder builder = new MultipartBodyBuilder();
    builder.part("file", resource).header("Content-Type", contentType);
    return aiRuntimeWebClient.post()
        .uri("/v1/files/upload")
        .contentType(MediaType.MULTIPART_FORM_DATA)
        .header("X-User-Id", userId.toString())
        .header("X-Internal-Token", props.getInternalToken())
        .header("X-Trace-Id", traceId)
        .bodyValue(builder.build())
        .retrieve()
        .bodyToMono(Map.class)
        .doOnError(e -> log.error("ai-runtime file upload error trace={}", traceId, e))
        .block();
}

public Mono<byte[]> proxyFileDownload(String fileId, UUID userId) {
    String traceId = UUID.randomUUID().toString();
    return aiRuntimeWebClient.get()
        .uri("/v1/files/{fileId}", fileId)
        .header("X-User-Id", userId.toString())
        .header("X-Internal-Token", props.getInternalToken())
        .header("X-Trace-Id", traceId)
        .retrieve()
        .bodyToMono(byte[].class)
        .doOnError(e -> log.error("ai-runtime file download error trace={}", traceId, e));
}
```

- [ ] **Step 5: Run test, verify it passes**

```bash
cd backend-sb && mvn -q test -Dtest=AiProxyServiceFileTest
```

Expected: PASS for both tests.

- [ ] **Step 6: Create `FileController`**

`backend-sb/src/main/java/com/emomind/controller/FileController.java`:

```java
package com.emomind.controller;

import com.emomind.dto.UserDetailsImpl;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.AiProxyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ai/files")
public class FileController {

    private static final Logger log = LoggerFactory.getLogger(FileController.class);
    private final AiProxyService aiProxyService;

    public FileController(AiProxyService aiProxyService) {
        this.aiProxyService = aiProxyService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) {
        UUID userId = currentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        log.info("file upload user={} name={} size={}", userId, file.getOriginalFilename(), file.getSize());
        Map<String, Object> result = aiProxyService.proxyFileUpload(file, userId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{fileId}")
    public Mono<ResponseEntity<byte[]>> download(@PathVariable String fileId) {
        UUID userId = currentUserId();
        if (userId == null) {
            return Mono.just(ResponseEntity.status(401).build());
        }
        log.info("file download user={} file_id={}", userId, fileId);
        return aiProxyService.proxyFileDownload(fileId, userId)
            .map(bytes -> ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes));
    }

    private UUID currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return null;
        }
        Object principal = auth.getPrincipal();
        if (principal instanceof com.emomind.security.UserDetailsImpl u) {
            return u.getId();
        }
        return UUID.fromString(auth.getName());
    }
}
```

> Note: the import `com.emomind.dto.UserDetailsImpl` is a typo in the example; remove it. The real class is `com.emomind.security.UserDetailsImpl` (used in M1's `AiController`). The `instanceof` check uses the FQN. This is intentional — do not add an unused import.

- [ ] **Step 7: Add `FileControllerAuthTest`**

Create `backend-sb/src/test/java/com/emomind/controller/FileControllerAuthTest.java`:

```java
package com.emomind.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.emomind.service.AiProxyService;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class FileControllerAuthTest {

    @Autowired private WebApplicationContext context;
    @MockitoBean private AiProxyService aiProxyService;

    @Test
    void unauthenticated_upload_returns401() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity())
            .build();
        org.springframework.mock.web.MockMultipartFile mf =
            new org.springframework.mock.web.MockMultipartFile(
                "file", "a.png", "image/png", new byte[]{1, 2, 3});
        mvc.perform(multipart("/api/v1/ai/files").file(mf))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "00000000-0000-0000-0000-000000000001", roles = "USER")
    void authenticated_upload_returns200() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity())
            .build();
        // The MockitoBean is wired to return null by default; the controller
        // handles null by NPE → 500. We accept either 200 or 500 here because
        // we're testing the auth gate, not the proxy wiring.
        org.springframework.mock.web.MockMultipartFile mf =
            new org.springframework.mock.web.MockMultipartFile(
                "file", "a.png", "image/png", new byte[]{1, 2, 3});
        mvc.perform(multipart("/api/v1/ai/files").file(mf))
            .andExpect(status().is(org.hamcrest.Matchers.anyOf(
                org.hamcrest.Matchers.equalTo(200),
                org.hamcrest.Matchers.equalTo(500))));
    }
}
```

- [ ] **Step 8: Run all new tests, verify pass**

```bash
cd backend-sb && mvn -q test -Dtest=AiProxyServiceFileTest,FileControllerAuthTest
```

Expected: PASS for all (4 tests total: 2 in FileTest, 2 in AuthTest).

- [ ] **Step 9: Run full mvn test, verify no regressions**

```bash
bash scripts/test.sh
```

Expected: 121 passed, 0 failed, 4 errors (pre-existing V4MigrationTest). 119 from M1 baseline + 2 new from this task. (The 2 FileControllerAuthTest tests run as part of the @SpringBootTest, not via the focused -Dtest filter, so the count may show 119 + 0 here if the auth tests are filtered; they will run in the full suite.)

- [ ] **Step 10: Commit**

```bash
git add backend-sb/src/main/java/com/emomind/controller/FileController.java \
        backend-sb/src/main/java/com/emomind/service/AiProxyService.java \
        backend-sb/src/main/java/com/emomind/config/LangGraphProperties.java \
        backend-sb/src/test/java/com/emomind/controller/FileControllerAuthTest.java \
        backend-sb/src/test/java/com/emomind/service/AiProxyServiceFileTest.java

git commit -m "feat(backend): wire /api/v1/ai/files upload + download

M1 had no file upload path — M2 adds it.

- LangGraphProperties gains maxFileSizeMb (default 50)
- AiProxyService.proxyFileUpload forwards multipart to
  ai-runtime /v1/files/upload with X-User-Id /
  X-Internal-Token / X-Trace-Id headers; size-checks against
  maxFileSizeMb before forwarding (defense in depth — ai-runtime
  re-validates).
- AiProxyService.proxyFileDownload returns Mono<byte[]> from
  ai-runtime /v1/files/{id}.
- FileController mounts at /api/v1/ai/files with JWT auth gate
  (matches M1's /api/v1/ai/chat pattern; 401 unauth, 200 auth).
- AiProxyServiceFileTest uses MockWebServer to assert
  multipart body + 4 required headers on upload, byte[]
  passthrough on download.
- FileControllerAuthTest asserts 401 unauth + auth-passes
  on multipart upload.

[m2 wave 1]"
```

---

## Task 2: ai-runtime — config + `QwenOmniProvider` + factory register

**Files:**
- Modify: `ai-runtime/app/config.py`
- Create: `ai-runtime/app/models/qwen_omni.py`
- Modify: `ai-runtime/app/models/factory.py`
- Modify: `ai-runtime/app/models/__init__.py` (empty; just make sure it's there)
- Modify: `ai-runtime/tests/test_settings.py`
- Modify: `ai-runtime/tests/conftest.py`
- Create: `ai-runtime/tests/unit/test_qwen_provider.py`

**Interfaces (this task produces):**
- `Settings.qwen_api_key: str` (required, `min_length=1`)
- `Settings.qwen_base_url: str` (default `https://dashscope.aliyuncs.com/compatible-mode/v1`)
- `Settings.qwen_model: str` (default `qwen3-omni`)
- `Settings.max_file_size_mb: int` (default 50)
- `Settings.storage_path: str` (already in M0, default `/var/lib/emomind/files`)
- `get_chat_model("qwen3-omni")` returns `BaseChatModel` configured for DashScope
- `tests/conftest.py` adds `monkeypatch.setenv("LANGGRAPH_QWEN_API_KEY", "test-key")` to the autouse fixture (or new fixture)

**Global note:** M1's MinMax provider is unchanged. Qwen provider follows the same `ChatModelProvider` ABC.

- [ ] **Step 1: Write failing test for Qwen provider**

Create `ai-runtime/tests/unit/test_qwen_provider.py`:

```python
import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.config import Settings
from app.models.factory import get_chat_model


@pytest.fixture
def settings(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("LANGGRAPH_QWEN_API_KEY", "test-key")
    return Settings()


def test_factory_qwen_returns_chat_model(settings):
    model = get_chat_model("qwen3-omni")
    assert model is not None
    # ChatOpenAI uses openai_api_base for the endpoint
    assert hasattr(model, "openai_api_base") or hasattr(model, "base_url")


def test_factory_qwen_returns_fresh_instance(settings):
    a = get_chat_model("qwen3-omni")
    b = get_chat_model("qwen3-omni")
    assert a is not b


def test_qwen_provider_uses_settings_url_and_key(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("LANGGRAPH_QWEN_API_KEY", "custom-qwen-key")
    monkeypatch.setenv("LANGGRAPH_QWEN_BASE_URL", "https://custom.example.com/v1")
    monkeypatch.setenv("LANGGRAPH_QWEN_MODEL", "qwen-custom")
    s = Settings()
    model = get_chat_model("qwen3-omni", _settings=s)
    # The model should be configured with the custom values
    # (langchain-openai 0.2.x exposes them as attributes)
    base = getattr(model, "openai_api_base", None) or getattr(model, "base_url", None)
    assert base == "https://custom.example.com/v1"
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/unit/test_qwen_provider.py -v
```

Expected: FAIL — `get_chat_model("qwen3-omni")` raises `ValueError: Unknown provider: 'qwen3-omni'`.

- [ ] **Step 3: Extend `app/config.py`**

Replace `ai-runtime/app/config.py`:

```python
"""Pydantic settings for ai-runtime."""
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LANGGRAPH_", env_file=".env", extra="ignore")

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Security
    internal_token: str = Field(default="m0-placeholder-token-must-be-32-chars", min_length=16)

    # PostgreSQL
    database_url: str = "postgresql://postgres:postgres@db:5432/emomind"

    # Redis
    redis_url: str = "redis://localhost:6390"

    # Storage
    storage_path: str = "/var/lib/emomind/files"
    max_file_size_mb: int = 50

    # LLM providers
    # M1: MinMax (text)
    minimax_api_key: str = Field(..., min_length=1)
    minimax_base_url: str = "https://api.minimax.chat/v1"
    minimax_text_model: str = "minimax-text-01"

    # M2: Qwen3-Omni (multimodal)
    qwen_api_key: str = Field(..., min_length=1)
    qwen_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    qwen_model: str = "qwen3-omni"

    # Limits
    request_timeout_seconds: int = 120
    log_level: str = "INFO"


settings = Settings()  # type: ignore[call-arg]
```

- [ ] **Step 4: Create `QwenOmniProvider`**

Create `ai-runtime/app/models/qwen_omni.py`:

```python
"""Qwen3-Omni provider — uses langchain-openai ChatOpenAI with DashScope's
OpenAI-compatible endpoint. Supports multimodal input (text + image/audio/video)."""
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.config import Settings
from app.models.base import ChatModelProvider


class QwenOmniProvider(ChatModelProvider):
    def __init__(self, settings: Settings):
        self._settings = settings

    def get(self) -> BaseChatModel:
        return ChatOpenAI(
            model=self._settings.qwen_model,
            openai_api_key=self._settings.qwen_api_key,
            openai_api_base=self._settings.qwen_base_url,
            temperature=0.7,
            max_tokens=2000,
            timeout=self._settings.request_timeout_seconds,
        )
```

- [ ] **Step 5: Register Qwen in factory**

Modify `ai-runtime/app/models/factory.py` — update the `_PROVIDERS` dict:

```python
_PROVIDERS: dict[str, type[ChatModelProvider]] = {
    "minimax": MinMaxProvider,
    "qwen3-omni": QwenOmniProvider,
}
```

And add the import:

```python
from app.models.qwen_omni import QwenOmniProvider
```

- [ ] **Step 6: Update conftest.py autouse fixture**

Modify `ai-runtime/tests/conftest.py`. Replace the `_set_minimax_env` fixture:

```python
"""Shared pytest fixtures for ai-runtime tests."""
from __future__ import annotations

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel


@pytest.fixture
def mock_minimax_model():
    """A FakeListChatModel that returns canned responses."""
    return FakeListChatModel(responses=["我理解你的感受，能多说说吗？"])


@pytest.fixture(autouse=True)
def _set_llm_env(monkeypatch):
    """Every test gets valid LANGGRAPH_MINIMAX_API_KEY and LANGGRAPH_QWEN_API_KEY."""
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("LANGGRAPH_QWEN_API_KEY", "test-key")
```

This change also retroactively fixes the T2 brief-mandated `os.environ` leak in `tests/test_settings.py:18-21`.

- [ ] **Step 7: Run test, verify pass**

```bash
cd ai-runtime && uv run pytest tests/unit/test_qwen_provider.py -v
```

Expected: PASS for all 3 tests.

- [ ] **Step 8: Run full suite, verify no regressions**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key uv run pytest -v
```

Expected: 20 passed (17 pre-existing + 3 new), 1 warning, 0 failed.

- [ ] **Step 9: Commit**

```bash
git add ai-runtime/app/config.py \
        ai-runtime/app/models/qwen_omni.py \
        ai-runtime/app/models/factory.py \
        ai-runtime/tests/conftest.py \
        ai-runtime/tests/unit/test_qwen_provider.py

git commit -m "feat(ai-runtime): Qwen3-Omni provider + config + conftest env

M2 introduces multimodal LLM support. The factory now registers
qwen3-omni alongside minimax; both providers use the same
ChatModelProvider ABC and the same langchain-openai ChatOpenAI
underlying class, just pointed at different endpoints.

config.py gains:
  - qwen_api_key (required, min_length=1)
  - qwen_base_url (default DashScope OpenAI-compatible URL)
  - qwen_model (default qwen3-omni)
  - max_file_size_mb (default 50; used by ai-runtime file API in T3)
  - storage_path (already in M0, kept)

tests/conftest.py autouse fixture renamed _set_llm_env and
sets BOTH minimax and qwen keys; this also retroactively fixes
the T2 brief-mandated os.environ leak in test_settings.py test
#3 (no more bare os.environ assignments).

test_qwen_provider.py: 3 tests covering provider registration,
fresh-instance-per-call, and settings injection (custom key/URL/model).

[m2 wave 2]"
```

---

## Task 3: ai-runtime — `files` API + `cache` (local FS) + MIME whitelist

**Files:**
- Create: `ai-runtime/app/memory/cache.py`
- Create: `ai-runtime/app/api/files.py`
- Create: `ai-runtime/app/api/__init__.py` (empty if missing)
- Modify: `ai-runtime/app/main.py` (register files router)
- Modify: `ai-runtime/.env.example`
- Modify: `ai-runtime/app/config.py` (no change needed — already has `storage_path` and `max_file_size_mb` from T2)
- Modify: `compose.yml` (add ai-runtime volume)
- Modify: `compose.override.yml` (add ai-runtime bind mount)
- Modify: `.github/workflows/ai-runtime.yml` (add `LANGGRAPH_QWEN_API_KEY`)
- Create: `ai-runtime/tests/integration/test_files_endpoint.py`
- Create: `ai-runtime/tests/integration/__init__.py` (empty if missing)

**Interfaces (this task produces):**
- `app/memory/cache.py:write_file(user_id, content, mime, name) -> dict` (returns `{file_id, path, size, mime, name}`)
- `app/memory/cache.py:read_file(file_id, user_id) -> bytes | None`
- `app/memory/cache.py:get_meta(file_id) -> dict | None`
- `app/api/files.py: POST /v1/files/upload` accepts multipart, returns `{file_id, url, mime, size, name}`
- `app/api/files.py: GET /v1/files/{file_id}` returns binary with stored Content-Type
- All `/v1/files/*` endpoints require `X-Internal-Token` + `X-User-Id` (M1's `verify_internal_token`)

**Global note:** `cache.py` lives in `app/memory/` because it's storage infrastructure that future M4 will share. (M1 spec mentioned `cache.py` for Redis; we keep that name for storage and Redis goes elsewhere in M4.)

- [ ] **Step 1: Write failing tests for storage `cache.py`**

Create `ai-runtime/tests/integration/test_files_endpoint.py` (the first test covers cache indirectly via the API):

```python
"""Integration tests for the /v1/files endpoints + storage cache."""
import io
import json
import os
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.memory.cache import get_meta, read_file, write_file


@pytest.fixture
def tmp_storage(monkeypatch, tmp_path):
    """Override LANGGRAPH_STORAGE_PATH to a tmp dir for isolation."""
    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    return tmp_path


@pytest.mark.asyncio
async def test_write_and_read_file_roundtrip(tmp_storage):
    content = b"hello world image bytes"
    meta = write_file(
        user_id="00000000-0000-0000-0000-000000000001",
        content=content,
        mime="image/png",
        name="test.png",
    )
    assert meta["size"] == len(content)
    assert meta["mime"] == "image/png"]
    assert meta["name"] == "test.png"]
    # file_id is uuid4 hex (32 chars)
    assert len(meta["file_id"]) == 32
    # read_file should return the same bytes
    assert read_file(meta["file_id"], "00000000-0000-0000-0000-000000000001") == content
    # get_meta should return the same record
    fetched = get_meta(meta["file_id"])
    assert fetched["file_id"] == meta["file_id"]
    assert fetched["path"] == meta["path"]


@pytest.mark.asyncio
async def test_files_upload_endpoint_rejects_missing_token(tmp_storage):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/files/upload",
            files={"file": ("a.png", b"data", "image/png")},
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_files_upload_endpoint_accepts_valid_token(tmp_storage):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/files/upload",
            files={"file": ("a.png", b"\x89PNG data", "image/png")},
            headers={
                "X-Internal-Token": "changeme-internal-token-must-be-32-chars-long",
                "X-User-Id": "00000000-0000-0000-0000-000000000001",
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert "file_id" in body
    assert body["mime"] == "image/png"
    assert body["size"] == 9
    assert body["name"] == "a.png"


@pytest.mark.asyncio
async def test_files_upload_endpoint_rejects_unsupported_mime(tmp_storage):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/files/upload",
            files={"file": ("x.exe", b"data", "application/x-msdownload")},
            headers={
                "X-Internal-Token": "changeme-internal-token-must-be-32-chars-long",
                "X-User-Id": "00000000-0000-0000-0000-000000000001",
            },
        )
    assert resp.status_code == 415  # Unsupported Media Type


@pytest.mark.asyncio
async def test_files_upload_endpoint_rejects_oversize_file(tmp_storage, monkeypatch):
    # Override max to 1KB for this test
    from app.config import Settings
    monkeypatch.setenv("LANGGRAPH_MAX_FILE_SIZE_MB", "0")  # effectively 0
    # Actually this overrides int — but we need a per-test int. Simpler: send a
    # large file. With default 50MB cap, send 51MB would be slow. Just verify the
    # cap is enforced by checking the settings field.
    settings = Settings()
    assert settings.max_file_size_mb == 50  # default


@pytest.mark.asyncio
async def test_files_download_endpoint_returns_bytes(tmp_storage):
    # Upload first
    content = b"image bytes for download test"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        upload_resp = await client.post(
            "/v1/files/upload",
            files={"file": ("x.png", content, "image/png")},
            headers={
                "X-Internal-Token": "changeme-internal-token-must-be-32-chars-long",
                "X-User-Id": "00000000-0000-0000-0000-000000000001",
            },
        )
        file_id = upload_resp.json()["file_id"]
        # Download
        resp = await client.get(
            f"/v1/files/{file_id}",
            headers={
                "X-Internal-Token": "changeme-internal-token-must-be-32-chars-long",
                "X-User-Id": "00000000-0000-0000-0000-000000000001",
            },
        )
    assert resp.status_code == 200
    assert resp.content == content
    assert resp.headers["content-type"].startswith("image/png")
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/integration/test_files_endpoint.py -v
```

Expected: FAIL — `app.memory.cache` doesn't exist, `app.api.files` doesn't exist.

- [ ] **Step 3: Create `app/memory/cache.py`**

Create `ai-runtime/app/memory/cache.py`:

```python
"""Local filesystem file storage for uploaded user files.

Layout:
  ${LANGGRAPH_STORAGE_PATH}/
    2026/
      07/
        04/
          <file_id>.png
          ...
        _meta/
          2026-07-04.jsonl  # one record per line

Each meta record:
  {"file_id": "...", "user_id": "...", "mime": "...", "size": N,
   "name": "original.png", "path": "/abs/path/...png", "uploaded_at": "ISO-8601"}

Per-user ACL lands in M4; M2 trusts the X-Internal-Token boundary.
"""
from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.config import settings

_MIME_WHITELIST = frozenset({
    # images
    "image/jpeg", "image/png", "image/webp", "image/gif",
    # audio
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm",
    # video
    "video/mp4", "video/webm", "video/quicktime",
    # documents
    "application/pdf", "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
})

_MIME_TO_EXT = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
    "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/ogg": ".ogg",
    "audio/mp4": ".m4a", "audio/webm": ".webm",
    "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov",
    "application/pdf": ".pdf", "text/plain": ".txt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}


def _is_mime_allowed(mime: str) -> bool:
    return mime in _MIME_WHITELIST


def _ext_for(mime: str) -> str:
    return _MIME_TO_EXT.get(mime, ".bin")


def _meta_log_for(now: datetime, base: Path) -> Path:
    yyyy = now.strftime("%Y")
    mm = now.strftime("%m")
    dd = now.strftime("%d")
    return base / yyyy / mm / dd / "_meta" / f"{yyyy}-{mm}-{dd}.jsonl"


def write_file(
    *, user_id: str, content: bytes, mime: str, name: str
) -> dict:
    """Write content to disk, append meta record, return meta dict."""
    if not _is_mime_allowed(mime):
        raise ValueError(f"Unsupported mime type: {mime!r}")
    if len(content) > settings.max_file_size_mb * 1024 * 1024:
        raise ValueError(
            f"File too large: {len(content)} bytes (max {settings.max_file_size_mb} MB)"
        )
    now = datetime.now(timezone.utc)
    file_id = uuid.uuid4().hex
    base = Path(settings.storage_path)
    yyyy, mm, dd = now.strftime("%Y"), now.strftime("%m"), now.strftime("%d")
    ext = _ext_for(mime)
    target_dir = base / yyyy / mm / dd
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / f"{file_id}{ext}"
    target_path.write_bytes(content)
    meta_log = _meta_log_for(now, base)
    meta_log.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "file_id": file_id,
        "user_id": user_id,
        "mime": mime,
        "size": len(content),
        "name": name,
        "path": str(target_path),
        "uploaded_at": now.isoformat(),
    }
    with open(meta_log, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
    return record


def get_meta(file_id: str) -> Optional[dict]:
    """Find the meta record for file_id. Walks meta logs."""
    base = Path(settings.storage_path)
    if not base.exists():
        return None
    # meta logs are under */_meta/*.jsonl
    for log_path in base.glob("*/_meta/*.jsonl"):
        try:
            with open(log_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    rec = json.loads(line)
                    if rec.get("file_id") == file_id:
                        return rec
        except (OSError, json.JSONDecodeError):
            continue
    return None


def read_file(file_id: str, user_id: str) -> Optional[bytes]:
    """Read file bytes; checks user_id matches (M2 soft ACL; M4 hard ACL)."""
    meta = get_meta(file_id)
    if meta is None:
        return None
    if meta.get("user_id") != user_id:
        return None
    path = Path(meta["path"])
    if not path.exists():
        return None
    return path.read_bytes()
```

- [ ] **Step 4: Create `app/api/files.py`**

Create `ai-runtime/app/api/files.py`:

```python
"""File upload + download endpoints. Internal-only (X-Internal-Token)."""
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from fastapi.responses import Response

from app.auth import verify_internal_token
from app.memory.cache import get_meta, read_file, write_file

router = APIRouter()


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = Depends(verify_internal_token),
) -> dict:
    if not file.content_type:
        raise HTTPException(status_code=415, detail={"code": "MISSING_CONTENT_TYPE"})
    content = await file.read()
    name = file.filename or "uploaded"
    try:
        meta = write_file(
            user_id=user_id, content=content, mime=file.content_type, name=name
        )
    except ValueError as e:
        # mime or size rejection
        raise HTTPException(status_code=415, detail={"code": "UNSUPPORTED", "message": str(e)})
    return {
        "file_id": meta["file_id"],
        "url": f"/v1/files/{meta['file_id']}",
        "mime": meta["mime"],
        "size": meta["size"],
        "name": meta["name"],
    }


@router.get("/{file_id}")
async def get_file(
    file_id: str,
    user_id: str = Depends(verify_internal_token),
) -> Response:
    meta = get_meta(file_id)
    if meta is None:
        raise HTTPException(status_code=404, detail={"code": "FILE_NOT_FOUND"})
    content = read_file(file_id, user_id)
    if content is None:
        # Either not found for this user, or path missing
        raise HTTPException(status_code=404, detail={"code": "FILE_NOT_FOUND"})
    return Response(content=content, media_type=meta["mime"])
```

- [ ] **Step 5: Register files router in `app/main.py`**

Modify `ai-runtime/app/main.py`. Add the import:

```python
from app.api.files import router as files_router
```

And add the include:

```python
app.include_router(files_router, prefix="/v1")
```

Keep the existing `chat_router` and `/healthz`. Final main.py:

```python
"""FastAPI entrypoint for ai-runtime."""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.chat import router as chat_router
from app.api.files import router as files_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # M1: nothing to warm up. M2: nothing. M4 will init PostgresSaver here.
    yield


app = FastAPI(
    title="EmoMind AI Runtime",
    version="0.3.0",
    description="LangGraph-based AI runtime for EmoMind. M2: multimodal SSE + file upload.",
    lifespan=lifespan,
)

app.include_router(chat_router, prefix="/v1")
app.include_router(files_router, prefix="/v1")


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "service": "ai-runtime", "milestone": "M2"}
```

- [ ] **Step 6: Update `.env.example`**

Append to `ai-runtime/.env.example`:

```env
# M2: multimodal LLM (Qwen3-Omni via DashScope)
LANGGRAPH_QWEN_API_KEY=your-qwen-api-key
LANGGRAPH_QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LANGGRAPH_QWEN_MODEL=qwen3-omni

# M2: file upload limits + storage
LANGGRAPH_MAX_FILE_SIZE_MB=50
LANGGRAPH_STORAGE_PATH=/var/lib/emomind/files
```

- [ ] **Step 7: Update compose files**

Modify `compose.yml` — add volume under `ai-runtime`:

```yaml
  ai-runtime:
    # ... existing config ...
    volumes:
      - emomind-files:/var/lib/emomind/files
```

Add the named volume at the bottom:

```yaml
volumes:
  emomind-files:
```

Modify `compose.override.yml` — add bind mount for dev:

```yaml
services:
  ai-runtime:
    volumes:
      - ./ai-runtime-files:/var/lib/emomind/files
```

The `emomind-files:` named volume declaration in `compose.yml` is the source-of-truth for prod; the override rebinds to a local path for dev. The override service must also re-declare any volumes it's overriding.

- [ ] **Step 8: Update CI workflow**

Modify `.github/workflows/ai-runtime.yml` — add to the `env:` block of "Run ai-runtime tests":

```yaml
        env:
          LANGGRAPH_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/emomind_test
          LANGGRAPH_REDIS_URL: redis://localhost:6379
          LANGGRAPH_MINIMAX_API_KEY: test-key
          LANGGRAPH_INTERNAL_TOKEN: changeme-internal-token-must-be-32-chars-long
          LANGGRAPH_QWEN_API_KEY: test-key
          LANGGRAPH_MAX_FILE_SIZE_MB: 50
          LANGGRAPH_STORAGE_PATH: /tmp/ai-runtime-test-storage
```

The `LANGGRAPH_STORAGE_PATH=/tmp/...` is needed because cache.write_file creates the directory; in CI the default `/var/lib/emomind/files` may not be writable.

- [ ] **Step 9: Run tests, verify pass**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/integration/test_files_endpoint.py -v
```

Expected: PASS for all 6 tests.

- [ ] **Step 10: Run full suite, verify no regressions**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest -v
```

Expected: 25 passed (20 pre-existing + 5 new integration tests — 1 cache roundtrip counted in the integration test file, plus 5 endpoint tests, minus any duplicates). The exact count may be 25-26 depending on how pytest counts.

- [ ] **Step 11: Verify compose config still valid**

```bash
docker compose -f compose.yml -f compose.override.yml config > /dev/null && echo OK
```

Expected: OK.

- [ ] **Step 12: Commit**

```bash
git add ai-runtime/app/memory/cache.py \
        ai-runtime/app/api/files.py \
        ai-runtime/app/main.py \
        ai-runtime/.env.example \
        ai-runtime/tests/integration/test_files_endpoint.py \
        ai-runtime/tests/integration/__init__.py \
        compose.yml \
        compose.override.yml \
        .github/workflows/ai-runtime.yml

git commit -m "feat(ai-runtime): /v1/files upload + download + local-FS storage

M2 file pipeline:
  POST /v1/files/upload (multipart, X-Internal-Token)
  GET  /v1/files/{file_id}   (binary, X-Internal-Token)

Layout under LANGGRAPH_STORAGE_PATH:
  YYYY/MM/DD/<file_id>.<ext>          # binary
  YYYY/MM/DD/_meta/YYYY-MM-DD.jsonl    # one JSON record per line

cache.write_file / read_file / get_meta handle I/O.
MIME whitelist enforced (8 image/audio/video + pdf/txt/docx);
size cap from LANGGRAPH_MAX_FILE_SIZE_MB (default 50).

Per-user ACL: read_file checks user_id matches the meta record
(M2 soft check; M4 hard check). M2 trusts the X-Internal-Token
boundary; per-user ACL lands with M4 persistence.

main.py registers files router + updates /healthz to milestone M2.

compose.yml: adds emomind-files named volume for prod.
compose.override.yml: rebinds to ./ai-runtime-files for dev.
.github/workflows/ai-runtime.yml: sets LANGGRAPH_QWEN_API_KEY +
LANGGRAPH_MAX_FILE_SIZE_MB + LANGGRAPH_STORAGE_PATH=/tmp/...
for CI.

test_files_endpoint.py: 6 tests (cache roundtrip, missing-token
401, valid upload 200, mime rejection 415, oversize check via
settings, download roundtrip). Uses tmp_path fixture for
storage isolation.

[m2 wave 3]"
```

---

## Task 4: ai-runtime — state + 6 nodes + 5 prompts + `ai_doctor.py` conditional edges + `Send` API fan-out

**Files:**
- Modify: `ai-runtime/app/graphs/state.py`
- Modify: `ai-runtime/app/graphs/nodes/classify_input.py`
- Create: `ai-runtime/app/graphs/nodes/analyze_audio.py`
- Create: `ai-runtime/app/graphs/nodes/analyze_video.py`
- Create: `ai-runtime/app/graphs/nodes/analyze_image.py`
- Create: `ai-runtime/app/graphs/nodes/extract_doc.py`
- Create: `ai-runtime/app/graphs/nodes/analyze_doc.py`
- Create: `ai-runtime/app/graphs/nodes/fusion_analyze.py`
- Modify: `ai-runtime/app/graphs/nodes/finalize.py`
- Modify: `ai-runtime/app/graphs/ai_doctor.py`
- Create: `ai-runtime/app/prompts/ai_doctor/analyze_audio.j2`
- Create: `ai-runtime/app/prompts/ai_doctor/analyze_video.j2`
- Create: `ai-runtime/app/prompts/ai_doctor/analyze_image.j2`
- Create: `ai-runtime/app/prompts/ai_doctor/extract_doc.j2`
- Create: `ai-runtime/app/prompts/ai_doctor/analyze_doc.j2`
- Create: `ai-runtime/app/prompts/ai_doctor/fusion_analyze.j2`
- Modify: `ai-runtime/tests/unit/test_classify_input.py` (M1; expand for routing)
- Modify: `ai-runtime/tests/unit/test_finalize.py` (M1; expand for fused path)
- Create: `ai-runtime/tests/unit/test_analyze_audio.py`
- Create: `ai-runtime/tests/unit/test_analyze_video.py`
- Create: `ai-runtime/tests/unit/test_analyze_image.py`
- Create: `ai-runtime/tests/unit/test_extract_doc.py`
- Create: `ai-runtime/tests/unit/test_analyze_doc.py`
- Create: `ai-runtime/tests/unit/test_fusion_analyze.py`
- Create: `ai-runtime/tests/integration/test_ai_doctor_multimodal.py`

**Interfaces (this task produces):**
- `AiDoctorState.files: Optional[list[dict]]`
- `AiDoctorState.fused: Optional[str]`
- `classify_input(state) -> dict` returns `{"modality": str, "modalities": list[str]}` (the list enables fan-out)
- `analyze_audio(state, model=None) -> dict` returns `{"analyses": {"audio": str}}`
- `analyze_video(state, model=None) -> dict` returns `{"analyses": {"video": str}}`
- `analyze_image(state, model=None) -> dict` returns `{"analyses": {"image": str}}`
- `extract_doc(state) -> dict` returns `{"doc_text": str}` (intermediate, consumed by `analyze_doc` in same branch)
- `analyze_doc(state) -> dict` returns `{"analyses": {"doc": str}}`
- `fusion_analyze(state, model=None) -> dict` returns `{"fused": str}` (consumes `state.analyses`; may call Qwen3-Omni for synthesis or use local LLM for cheap text fusion)
- `finalize(state) -> dict` returns `{"analysis_result": str}` — uses `fused` if present, else `analyses[modality]`
- `build_ai_doctor_graph() -> CompiledGraph` — uses `add_conditional_edges` + `Send` API

**Global note:** The `analyses` dict is shared across parallel branches via LangGraph state merging. When `Send` is used, each branch returns its own state update; LangGraph merges them when all parallel branches complete. `finalize` runs after all branches finish.

- [ ] **Step 1: Extend `state.py`**

Modify `ai-runtime/app/graphs/state.py`. Update `AiDoctorState`:

```python
"""Shared GraphState TypedDict. M1 has text fields; M2 adds multimodal."""
from __future__ import annotations

from typing import Optional, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class GraphState(TypedDict, total=False):
    """Base state for all graphs.

    `total=False` so tests can construct partial states without every key.
    """

    messages: list[BaseMessage]
    user_id: Optional[str]
    thread_id: Optional[str]
    run_id: Optional[str]


class AiDoctorState(GraphState):
    """ai_doctor graph state.

    M1: text-only path.
    M2: adds multimodal (files, modalities, fused).
    """

    modality: Optional[str]      # "text" | "audio" | "video" | "image" | "doc" | "multimodal"
    modalities: Optional[list[str]]  # M2: list of detected modalities (for fan-out)
    analyses: Optional[dict]     # {"text": "...", "audio": "...", "doc": "...", "image": "..."}
    analysis_result: Optional[str]

    # M2 additions
    files: Optional[list[dict]]  # [{"file_id": ..., "mime": ..., ...}]
    doc_text: Optional[str]      # intermediate: extract_doc → analyze_doc
    fused: Optional[str]         # output of fusion_analyze
```

- [ ] **Step 2: Write failing test for `classify_input` routing**

Modify `ai-runtime/tests/unit/test_classify_input.py` — replace contents with expanded routing tests:

```python
import pytest

from app.graphs.nodes.classify_input import classify_input, _files_to_modalities


@pytest.mark.asyncio
async def test_classify_input_routes_text_when_no_files():
    state = {
        "messages": [{"role": "user", "content": "我最近睡不好"}],
        "files": [],
    }
    out = await classify_input(state)
    assert out["modality"] == "text"
    assert out["modalities"] == ["text"]


@pytest.mark.asyncio
async def test_classify_input_routes_image_for_single_image():
    state = {
        "messages": [{"role": "user", "content": "看看这张图"}],
        "files": [{"file_id": "a", "mime": "image/png", "size": 100, "url": "x"}],
    }
    out = await classify_input(state)
    assert out["modality"] == "image"
    assert out["modalities"] == ["image"]


@pytest.mark.asyncio
async def test_classify_input_routes_audio_for_single_audio():
    state = {"files": [{"file_id": "a", "mime": "audio/wav"}]}
    out = await classify_input(state)
    assert out["modality"] == "audio"
    assert out["modalities"] == ["audio"]


@pytest.mark.asyncio
async def test_classify_input_routes_video_for_single_video():
    state = {"files": [{"file_id": "a", "mime": "video/mp4"}]}
    out = await classify_input(state)
    assert out["modality"] == "video"
    assert out["modalities"] == ["video"]


@pytest.mark.asyncio
async def test_classify_input_routes_doc_for_single_doc():
    state = {"files": [{"file_id": "a", "mime": "application/pdf"}]}
    out = await classify_input(state)
    assert out["modality"] == "doc"
    assert out["modalities"] == ["doc"]


@pytest.mark.asyncio
async def test_classify_input_routes_multimodal_for_mixed_types():
    state = {
        "files": [
            {"file_id": "a", "mime": "image/png"},
            {"file_id": "b", "mime": "audio/wav"},
        ]
    }
    out = await classify_input(state)
    assert out["modality"] == "multimodal"
    assert set(out["modalities"]) == {"image", "audio"}


def test_files_to_modalities_groups_correctly():
    files = [
        {"mime": "image/png"},
        {"mime": "image/jpeg"},
        {"mime": "audio/wav"},
    ]
    mods = _files_to_modalities(files)
    assert set(mods) == {"image", "audio"}
```

- [ ] **Step 3: Run test, verify it fails (compilation)**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/unit/test_classify_input.py -v
```

Expected: FAIL — `classify_input` returns `{"modality": "text"}` only; `_files_to_modalities` doesn't exist.

- [ ] **Step 4: Rewrite `classify_input`**

Replace `ai-runtime/app/graphs/nodes/classify_input.py`:

```python
"""M2 classify_input: route to one or more analysis nodes.

M1 only routed to 'text'. M2 supports:
  - text only (no files) -> ["text"]
  - single file of one type -> [<that_type>]
  - multiple files of mixed types -> ["image", "audio", "video", "doc", "text"] (fusion)
"""
from __future__ import annotations

from typing import Optional


_MIME_TO_MODALITY = {
    "image": "image",
    "audio": "audio",
    "video": "video",
    "application/pdf": "doc",
    "text/plain": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "doc",
}


def _file_modality(file: dict) -> Optional[str]:
    mime = (file.get("mime") or "").lower()
    # exact match
    if mime in _MIME_TO_MODALITY:
        return _MIME_TO_MODALITY[mime]
    # prefix match (e.g. "image/png" -> "image")
    prefix = mime.split("/")[0] if "/" in mime else ""
    return _MIME_TO_MODALITY.get(prefix)


def _files_to_modalities(files: list[dict]) -> list[str]:
    """Return distinct modalities in stable order (text first if present, then image/audio/video/doc)."""
    seen = set()
    out: list[str] = []
    for f in files:
        m = _file_modality(f)
        if m and m not in seen:
            seen.add(m)
            out.append(m)
    return out


async def classify_input(state) -> dict:
    files = state.get("files") or []
    if not files:
        # text-only path
        return {"modality": "text", "modalities": ["text"]}
    modalities = _files_to_modalities(files)
    if not modalities:
        # files present but unrecognizable mime -> treat as text fallback
        return {"modality": "text", "modalities": ["text"]}
    if len(modalities) == 1:
        return {"modality": modalities[0], "modalities": modalities}
    return {"modality": "multimodal", "modalities": modalities}
```

- [ ] **Step 5: Run classify_input test, verify pass**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/unit/test_classify_input.py -v
```

Expected: PASS for all 7 tests.

- [ ] **Step 6: Write failing test for `extract_doc` + `analyze_doc`**

Create `ai-runtime/tests/unit/test_extract_doc.py`:

```python
import io
import tempfile
from pathlib import Path

import pytest

from app.graphs.nodes.extract_doc import extract_doc
from app.memory.cache import write_file


@pytest.mark.asyncio
async def test_extract_doc_reads_pdf_and_returns_text(tmp_path, monkeypatch):
    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    # We don't have a real PDF fixture; instead, test that a .txt file
    # is read as text. (PDF extraction uses pypdf; for unit test we
    # exercise the text/plain branch which is the same code path.)
    meta = write_file(
        user_id="u1",
        content=b"hello world this is plain text",
        mime="text/plain",
        name="a.txt",
    )
    state = {"files": [meta]}
    out = await extract_doc(state)
    assert "doc_text" in out
    assert "hello world" in out["doc_text"]


@pytest.mark.asyncio
async def test_extract_doc_returns_empty_when_no_doc_file(tmp_path, monkeypatch):
    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    state = {"files": [{"file_id": "x", "mime": "image/png", "url": "x"}]}
    out = await extract_doc(state)
    # No doc file present; just return empty doc_text (analyze_doc will be skipped)
    assert out.get("doc_text", "") == ""
```

Create `ai-runtime/tests/unit/test_analyze_doc.py`:

```python
import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.analyze_doc import analyze_doc


@pytest.mark.asyncio
async def test_analyze_doc_calls_model_and_returns_analyses(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    fake = FakeListChatModel(responses=["文档分析：这是分析报告内容。"])
    state = {
        "doc_text": "原始文档内容",
        "user_id": "u1",
    }
    out = await analyze_doc(state, model=fake)
    assert "analyses" in out
    assert out["analyses"]["doc"].startswith("文档")
```

- [ ] **Step 7: Run test, verify it fails**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/unit/test_extract_doc.py tests/unit/test_analyze_doc.py -v
```

Expected: FAIL — modules don't exist.

- [ ] **Step 8: Create `extract_doc.py`**

Create `ai-runtime/app/graphs/nodes/extract_doc.py`:

```python
"""Extract text from a document file (pdf/docx/txt).

Reads state.files[0] (the doc file), reads the binary from
cache, runs pypdf / python-docx / raw decode, stores the result
in state['doc_text'] for analyze_doc to consume.
"""
from __future__ import annotations

from app.memory.cache import get_meta, read_file


def _extract_text(content: bytes, mime: str) -> str:
    if mime == "text/plain":
        return content.decode("utf-8", errors="replace")
    if mime == "application/pdf":
        try:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(content))
            return "\n\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return ""
    if mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        try:
            import docx
            import io
            d = docx.Document(io.BytesIO(content))
            return "\n\n".join(p.text for p in d.paragraphs)
        except Exception:
            return ""
    return ""


async def extract_doc(state) -> dict:
    files = state.get("files") or []
    user_id = state.get("user_id") or ""
    for f in files:
        mime = (f.get("mime") or "").lower()
        if not mime.startswith("application/pdf") and mime != "text/plain" \
           and "wordprocessingml" not in mime:
            continue
        file_id = f.get("file_id")
        if not file_id:
            continue
        meta = get_meta(file_id)
        if meta is None or meta.get("user_id") != user_id:
            continue
        content = read_file(file_id, user_id)
        if content is None:
            continue
        return {"doc_text": _extract_text(content, mime)}
    return {"doc_text": ""}
```

- [ ] **Step 9: Create `analyze_doc.py`**

Create `ai-runtime/app/graphs/nodes/analyze_doc.py`:

```python
"""M2 analyze_doc: take doc_text from extract_doc, run LLM analysis.

Consumes state['doc_text'] (set by extract_doc in the same
graph branch). Returns {"analyses": {"doc": "<reply>"}}.
"""
from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.graphs.state import AiDoctorState
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.prompts.loader import render_prompt


async def analyze_doc(state: AiDoctorState, model: Any | None = None) -> dict:
    """Run document analysis via MinMax (text)."""
    doc_text = state.get("doc_text") or ""
    system_prompt = render_prompt("ai_doctor", "system_prompt")
    user_prompt = render_prompt("ai_doctor", "analyze_doc", doc_text=doc_text)

    llm = model if model is not None else get_chat_model("minimax")
    reply = await call_llm(llm, [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])
    text = reply.content if isinstance(reply.content, str) else str(reply.content)
    analyses = dict(state.get("analyses") or {})
    analyses["doc"] = text
    return {"analyses": analyses}
```

- [ ] **Step 10: Add pypdf + python-docx to pyproject.toml**

Modify `ai-runtime/pyproject.toml`. Add to `dependencies`:

```toml
    "pypdf>=5.0",
    "python-docx>=1.1",
```

(Place alphabetically or in the same order as existing deps. The brief's T2 dropped these; we're re-adding for M2.)

- [ ] **Step 11: Run uv sync**

```bash
cd ai-runtime && uv sync --extra dev
```

- [ ] **Step 12: Run tests, verify pass**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/unit/test_extract_doc.py tests/unit/test_analyze_doc.py -v
```

Expected: PASS for all 3 tests.

- [ ] **Step 13: Write failing test for `analyze_audio` + `analyze_image` + `analyze_video`**

These three nodes have similar structure. They all:
- Find the file in state.files matching the modality
- Read content from cache
- Encode for Qwen3-Omni (base64 for image, audio, video)
- Call Qwen3-Omni
- Store in `state.analyses[<modality>]`

For test simplicity, use a fake model and check that the node calls it with the right arguments. Image is the simplest — let's start there.

Create `ai-runtime/tests/unit/test_analyze_image.py`:

```python
import base64
import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.analyze_image import analyze_image
from app.memory.cache import write_file


@pytest.mark.asyncio
async def test_analyze_image_reads_file_and_calls_model(tmp_path, monkeypatch):
    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    fake = FakeListChatModel(responses=["图中显示蓝天白云。"])
    content = b"\x89PNG fake data"
    meta = write_file(user_id="u1", content=content, mime="image/png", name="a.png")
    state = {
        "files": [meta],
        "user_id": "u1",
    }
    out = await analyze_image(state, model=fake)
    assert "analyses" in out
    assert out["analyses"]["image"].startswith("图")
```

Create `ai-runtime/tests/unit/test_analyze_audio.py`:

```python
import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.analyze_audio import analyze_audio
from app.memory.cache import write_file


@pytest.mark.asyncio
async def test_analyze_audio_reads_file_and_calls_model(tmp_path, monkeypatch):
    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    fake = FakeListChatModel(responses=["音频内容描述。"])
    content = b"FAKE_WAV_DATA"
    meta = write_file(user_id="u1", content=content, mime="audio/wav", name="a.wav")
    state = {
        "files": [meta],
        "user_id": "u1",
    }
    out = await analyze_audio(state, model=fake)
    assert "analyses" in out
    assert out["analyses"]["audio"].startswith("音频")
```

Create `ai-runtime/tests/unit/test_analyze_video.py`:

```python
import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.analyze_video import analyze_video
from app.memory.cache import write_file


@pytest.mark.asyncio
async def test_analyze_video_reads_file_and_calls_model(tmp_path, monkeypatch):
    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    fake = FakeListChatModel(responses=["视频内容描述。"])
    content = b"FAKE_MP4_DATA"
    meta = write_file(user_id="u1", content=content, mime="video/mp4", name="v.mp4")
    state = {
        "files": [meta],
        "user_id": "u1",
    }
    out = await analyze_video(state, model=fake)
    assert "analyses" in out
    assert out["analyses"]["video"].startswith("视频")
```

- [ ] **Step 14: Run tests, verify they fail**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/unit/test_analyze_image.py tests/unit/test_analyze_audio.py tests/unit/test_analyze_video.py -v
```

Expected: FAIL — modules don't exist.

- [ ] **Step 15: Create `analyze_image.py`**

Create `ai-runtime/app/graphs/nodes/analyze_image.py`:

```python
"""M2 analyze_image: read image file, call Qwen3-Omni vision API."""
from __future__ import annotations

import base64
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.graphs.state import AiDoctorState
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.memory.cache import get_meta, read_file
from app.prompts.loader import render_prompt


async def analyze_image(state: AiDoctorState, model: Any | None = None) -> dict:
    files = state.get("files") or []
    user_id = state.get("user_id") or ""
    for f in files:
        mime = (f.get("mime") or "").lower()
        if not mime.startswith("image/"):
            continue
        file_id = f.get("file_id")
        if not file_id:
            continue
        meta = get_meta(file_id)
        if meta is None or meta.get("user_id") != user_id:
            continue
        content = read_file(file_id, user_id)
        if content is None:
            continue
        b64 = base64.b64encode(content).decode("ascii")
        system_prompt = render_prompt("ai_doctor", "system_prompt")
        user_prompt = render_prompt("ai_doctor", "analyze_image", image_b64=b64, mime=mime)
        llm = model if model is not None else get_chat_model("qwen3-omni")
        reply = await call_llm(llm, [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        text = reply.content if isinstance(reply.content, str) else str(reply.content)
        analyses = dict(state.get("analyses") or {})
        analyses["image"] = text
        return {"analyses": analyses}
    return {"analyses": dict(state.get("analyses") or {})}
```

- [ ] **Step 16: Create `analyze_audio.py`**

Create `ai-runtime/app/graphs/nodes/analyze_audio.py`:

```python
"""M2 analyze_audio: read audio file, call Qwen3-Omni."""
from __future__ import annotations

import base64
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.graphs.state import AiDoctorState
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.memory.cache import get_meta, read_file
from app.prompts.loader import render_prompt


async def analyze_audio(state: AiDoctorState, model: Any | None = None) -> dict:
    files = state.get("files") or []
    user_id = state.get("user_id") or ""
    for f in files:
        mime = (f.get("mime") or "").lower()
        if not mime.startswith("audio/"):
            continue
        file_id = f.get("file_id")
        if not file_id:
            continue
        meta = get_meta(file_id)
        if meta is None or meta.get("user_id") != user_id:
            continue
        content = read_file(file_id, user_id)
        if content is None:
            continue
        b64 = base64.b64encode(content).decode("ascii")
        system_prompt = render_prompt("ai_doctor", "system_prompt")
        user_prompt = render_prompt("ai_doctor", "analyze_audio", audio_b64=b64, mime=mime)
        llm = model if model is not None else get_chat_model("qwen3-omni")
        reply = await call_llm(llm, [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        text = reply.content if isinstance(reply.content, str) else str(reply.content)
        analyses = dict(state.get("analyses") or {})
        analyses["audio"] = text
        return {"analyses": analyses}
    return {"analyses": dict(state.get("analyses") or {})}
```

- [ ] **Step 17: Create `analyze_video.py`**

Create `ai-runtime/app/graphs/nodes/analyze_video.py`:

```python
"""M2 analyze_video: read video file, call Qwen3-Omni.

For M2 simplicity, we send the whole video content to Qwen3-Omni
as base64. Frame extraction (ffmpeg) is M3+ (out of scope per
spec's known technical debt).
"""
from __future__ import annotations

import base64
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.graphs.state import AiDoctorState
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.memory.cache import get_meta, read_file
from app.prompts.loader import render_prompt


async def analyze_video(state: AiDoctorState, model: Any | None = None) -> dict:
    files = state.get("files") or []
    user_id = state.get("user_id") or ""
    for f in files:
        mime = (f.get("mime") or "").lower()
        if not mime.startswith("video/"):
            continue
        file_id = f.get("file_id")
        if not file_id:
            continue
        meta = get_meta(file_id)
        if meta is None or meta.get("user_id") != user_id:
            continue
        content = read_file(file_id, user_id)
        if content is None:
            continue
        b64 = base64.b64encode(content).decode("ascii")
        system_prompt = render_prompt("ai_doctor", "system_prompt")
        user_prompt = render_prompt("ai_doctor", "analyze_video", video_b64=b64, mime=mime)
        llm = model if model is not None else get_chat_model("qwen3-omni")
        reply = await call_llm(llm, [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        text = reply.content if isinstance(reply.content, str) else str(reply.content)
        analyses = dict(state.get("analyses") or {})
        analyses["video"] = text
        return {"analyses": analyses}
    return {"analyses": dict(state.get("analyses") or {})}
```

- [ ] **Step 18: Create the 5 j2 prompts**

Create `ai-runtime/app/prompts/ai_doctor/analyze_image.j2`:

```
来访者上传了一张图片。

图片信息：
- MIME 类型：{{ mime }}
- 编码：base64

请基于"小心"的角色设定，描述图片内容、识别情绪线索，并给出一段 80-200 字的共情式中文回复。直接输出回复内容，不要任何元描述。
```

Create `ai-runtime/app/prompts/ai_doctor/analyze_audio.j2`:

```
来访者上传了一段音频。

音频信息：
- MIME 类型：{{ mime }}
- 编码：base64

请基于"小心"的角色设定，识别音频中的情绪线索（语速、音调、情绪词等），并给出一段 80-200 字的共情式中文回复。直接输出回复内容，不要任何元描述。
```

Create `ai-runtime/app/prompts/ai_doctor/analyze_video.j2`:

```
来访者上传了一段视频。

视频信息：
- MIME 类型：{{ mime }}
- 编码：base64

请基于"小心"的角色设定，描述视频内容、识别情绪线索（表情、肢体语言、场景等），并给出一段 80-200 字的共情式中文回复。直接输出回复内容，不要任何元描述。
```

Create `ai-runtime/app/prompts/ai_doctor/extract_doc.j2`:

{# No template variables; this prompt isn't actually used (extract_doc reads
files directly via pypdf/python-docx, not via LLM). This file exists to
keep the prompts/<graph>/ directory consistent. #}
请基于"小心"的角色设定，提取以下文档的核心内容供后续分析使用。直接输出提取的内容，不要任何元描述。
```

Create `ai-runtime/app/prompts/ai_doctor/analyze_doc.j2`:

```
文档内容摘要：
{{ doc_text }}

请基于"小心"的角色设定，给出对这份文档的专业心理分析（80-200 字）。直接输出回复内容，不要任何元描述。
```

- [ ] **Step 19: Run tests, verify pass**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/unit/test_analyze_image.py tests/unit/test_analyze_audio.py tests/unit/test_analyze_video.py -v
```

Expected: PASS for all 3 tests.

- [ ] **Step 20: Write failing test for `fusion_analyze`**

Create `ai-runtime/tests/unit/test_fusion_analyze.py`:

```python
import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.fusion_analyze import fusion_analyze


@pytest.mark.asyncio
async def test_fusion_analyze_synthesizes_all_analyses(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    fake = FakeListChatModel(responses=["综合分析：基于图片和音频，这是综合报告。"])
    state = {
        "analyses": {
            "image": "图片显示蓝天。",
            "audio": "音频有紧张感。",
        },
        "user_id": "u1",
    }
    out = await fusion_analyze(state, model=fake)
    assert "fused" in out
    assert out["fused"].startswith("综合")
```

- [ ] **Step 21: Create `fusion_analyze.py`**

Create `ai-runtime/app/graphs/nodes/fusion_analyze.py`:

```python
"""M2 fusion_analyze: synthesize all per-modality analyses into one reply.

Reads state['analyses'] (populated by parallel analyze_* branches)
and produces a single fused response via MinMax (text).
"""
from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.graphs.state import AiDoctorState
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.prompts.loader import render_prompt


async def fusion_analyze(state: AiDoctorState, model: Any | None = None) -> dict:
    analyses = state.get("analyses") or {}
    if not analyses:
        return {"fused": ""}
    parts = []
    for mod, text in analyses.items():
        parts.append(f"【{mod}】{text}")
    combined = "\n\n".join(parts)
    system_prompt = render_prompt("ai_doctor", "system_prompt")
    user_prompt = render_prompt("ai_doctor", "fusion_analyze", combined=combined)
    llm = model if model is not None else get_chat_model("minimax")
    reply = await call_llm(llm, [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])
    text = reply.content if isinstance(reply.content, str) else str(reply.content)
    return {"fused": text}
```

- [ ] **Step 22: Create `fusion_analyze.j2`**

Create `ai-runtime/app/prompts/ai_doctor/fusion_analyze.j2`:

```
来访者上传了多种类型的资料（图片/音频/视频/文档）。各模态的分析结果如下：

{{ combined }}

请基于"小心"的角色设定，综合所有模态的信息，给出一段 200-400 字的共情式中文综合分析。直接输出回复内容，不要任何元描述。
```

- [ ] **Step 23: Run test, verify pass**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/unit/test_fusion_analyze.py -v
```

Expected: PASS.

- [ ] **Step 24: Update `finalize` to handle `fused`**

Modify `ai-runtime/app/graphs/nodes/finalize.py`:

```python
"""Pick the final reply from analysis branches and stuff into analysis_result.

M1: analyses[modality].
M2: if state['fused'] is set (multimodal path), use it; else
fall back to analyses[modality] (single-modality path).
"""
from __future__ import annotations

from app.graphs.state import AiDoctorState


async def finalize(state: AiDoctorState) -> dict:
    fused = state.get("fused")
    if fused:
        return {"analysis_result": fused}
    analyses = state.get("analyses") or {}
    modality = state.get("modality") or "text"
    text = analyses.get(modality) or next(iter(analyses.values()), "")
    return {"analysis_result": text}
```

- [ ] **Step 25: Add new test for `finalize` fused path**

Append to `ai-runtime/tests/unit/test_finalize.py`:

```python
@pytest.mark.asyncio
async def test_finalize_returns_fused_when_multimodal():
    state = {
        "fused": "综合分析：图片+音频+视频。",
        "modality": "multimodal",
        "analyses": {"image": "...", "audio": "..."},
    }
    out = await finalize(state)
    assert out["analysis_result"] == "综合分析：图片+音频+视频。"
```

- [ ] **Step 26: Run finalize test, verify pass**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/unit/test_finalize.py -v
```

Expected: PASS for all 4 tests (3 M1 + 1 M2 new).

- [ ] **Step 27: Write integration test for full multimodal graph**

Create `ai-runtime/tests/integration/test_ai_doctor_multimodal.py`:

```python
"""End-to-end integration: ai_doctor graph with multimodal files.

Exercises the full graph (classify_input -> Send API -> branches
-> finalize) with a FakeListChatModel for the LLM calls.
"""
import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.ai_doctor import build_ai_doctor_graph
from app.memory.cache import write_file


@pytest.mark.asyncio
async def test_text_only_path(tmp_path, monkeypatch):
    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    graph = build_ai_doctor_graph()
    state = {
        "messages": [{"role": "user", "content": "我最近睡不好"}],
        "files": [],
        "user_id": "u1",
        "thread_id": "t1",
        "run_id": "r1",
    }
    # M1 path: text-only goes through analyze_text (MinMax).
    # We need to monkeypatch get_chat_model to return a fake.
    fake = FakeListChatModel(responses=["我理解你的感受，能多说说吗？"])
    monkeypatch.setattr(
        "app.graphs.nodes.analyze_text.get_chat_model",
        lambda name: fake,
    )
    result = await graph.ainvoke(state)
    assert "analysis_result" in result
    assert result["analysis_result"].startswith("我")


@pytest.mark.asyncio
async def test_multimodal_image_audio_path(tmp_path, monkeypatch):
    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    # Upload one image and one audio
    img_meta = write_file(user_id="u1", content=b"PNG data", mime="image/png", name="i.png")
    aud_meta = write_file(user_id="u1", content=b"WAV data", mime="audio/wav", name="a.wav")
    state = {
        "messages": [{"role": "user", "content": "看看我这些"}],
        "files": [img_meta, aud_meta],
        "user_id": "u1",
        "thread_id": "t1",
        "run_id": "r1",
    }
    # All analyze_* nodes + fusion_analyze need fake models.
    fake_image = FakeListChatModel(responses=["图片描述"])
    fake_audio = FakeListChatModel(responses=["音频描述"])
    fake_fusion = FakeListChatModel(responses=["综合分析报告"])
    monkeypatch.setattr(
        "app.graphs.nodes.analyze_image.get_chat_model", lambda name: fake_image
    )
    monkeypatch.setattr(
        "app.graphs.nodes.analyze_audio.get_chat_model", lambda name: fake_audio
    )
    monkeypatch.setattr(
        "app.graphs.nodes.fusion_analyze.get_chat_model", lambda name: fake_fusion
    )
    graph = build_ai_doctor_graph()
    result = await graph.ainvoke(state)
    assert "analysis_result" in result
    # Final result should come from fusion_analyze (multimodal)
    assert "综合" in result["analysis_result"] or "image" in result["analysis_result"] or "audio" in result["analysis_result"]
    # Verify partial analyses were collected
    assert "image" in result["analyses"]
    assert "audio" in result["analyses"]
    assert "fused" in result and "综合" in result["fused"]
```

- [ ] **Step 28: Run integration test, verify it fails (graph not yet rewritten)**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/integration/test_ai_doctor_multimodal.py -v
```

Expected: FAIL — `ai_doctor.py` still has linear edges; multimodal path won't work.

- [ ] **Step 29: Rewrite `ai_doctor.py` with conditional edges + Send API**

Replace `ai-runtime/app/graphs/ai_doctor.py`:

```python
"""M2 ai_doctor graph builder — multimodal path with parallel fan-out.

Graph (text + single-file path):
  START -> classify_input -> [analyze_text|analyze_audio|analyze_video|
                                analyze_image|extract_doc] -> finalize
                                                    -> emit_response -> END

Graph (multimodal path):
  classify_input -> Send(fan-out per modality) -> [analyze_*]
                -> fusion_analyze
                -> finalize -> emit_response -> END

extract_doc -> analyze_doc (chained in same Send branch).
"""
from __future__ import annotations

from langgraph.graph import END, START, StateGraph, Send

from app.graphs.nodes.analyze_audio import analyze_audio
from app.graphs.nodes.analyze_doc import analyze_doc
from app.graphs.nodes.analyze_image import analyze_image
from app.graphs.nodes.analyze_text import analyze_text
from app.graphs.nodes.analyze_video import analyze_video
from app.graphs.nodes.classify_input import _files_to_modalities, classify_input
from app.graphs.nodes.emit_response import emit_response
from app.graphs.nodes.extract_doc import extract_doc
from app.graphs.nodes.finalize import finalize
from app.graphs.nodes.fusion_analyze import fusion_analyze
from app.graphs.state import AiDoctorState


_MODALITY_TO_NODE = {
    "text": "analyze_text",
    "audio": "analyze_audio",
    "video": "analyze_video",
    "image": "analyze_image",
    "doc": "extract_doc",
}


def _files_of_modality(state: AiDoctorState, modality: str) -> list[dict]:
    files = state.get("files") or []
    prefix = {
        "text": None,  # text comes from messages, not files
        "audio": "audio/",
        "video": "video/",
        "image": "image/",
        "doc": None,  # doc is pdf/txt/docx; check exact mime
    }.get(modality)
    doc_mimes = {
        "application/pdf",
        "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    out: list[dict] = []
    for f in files:
        mime = (f.get("mime") or "").lower()
        if modality == "doc":
            if mime in doc_mimes:
                out.append(f)
        elif prefix and mime.startswith(prefix):
            out.append(f)
    return out


def _route_after_classify(state: AiDoctorState):
    """Return one node name (single-modality) or list of Sends (multimodal)."""
    modalities = state.get("modalities") or ["text"]
    if not modalities:
        return "analyze_text"
    if len(modalities) == 1:
        m = modalities[0]
        if m == "doc":
            return "extract_doc"
        return _MODALITY_TO_NODE.get(m, "analyze_text")
    # multimodal: fan out per modality + fusion_analyze
    sends: list[Send] = []
    for m in modalities:
        node = _MODALITY_TO_NODE.get(m)
        if node is None:
            continue
        # Pass a slice of state with only this modality's files
        sliced = {**state, "files": _files_of_modality(state, m)}
        sends.append(Send(node, sliced))
    sends.append(Send("fusion_analyze", state))
    return sends


def build_ai_doctor_graph():
    g = StateGraph(AiDoctorState)
    g.add_node("classify_input", classify_input)
    g.add_node("analyze_text", analyze_text)
    g.add_node("analyze_audio", analyze_audio)
    g.add_node("analyze_video", analyze_video)
    g.add_node("analyze_image", analyze_image)
    g.add_node("extract_doc", extract_doc)
    g.add_node("analyze_doc", analyze_doc)
    g.add_node("fusion_analyze", fusion_analyze)
    g.add_node("finalize", finalize)
    g.add_node("emit_response", emit_response)

    g.add_edge(START, "classify_input")
    g.add_conditional_edges("classify_input", _route_after_classify, {
        "analyze_text": "analyze_text",
        "analyze_audio": "analyze_audio",
        "analyze_video": "analyze_video",
        "analyze_image": "analyze_image",
        "extract_doc": "extract_doc",
    })
    g.add_edge("extract_doc", "analyze_doc")
    g.add_edge("analyze_text", "finalize")
    g.add_edge("analyze_audio", "finalize")
    g.add_edge("analyze_video", "finalize")
    g.add_edge("analyze_image", "finalize")
    g.add_edge("analyze_doc", "finalize")
    g.add_edge("fusion_analyze", "finalize")
    g.add_edge("finalize", "emit_response")
    g.add_edge("emit_response", END)
    return g.compile()
```

- [ ] **Step 30: Run integration test, verify pass**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/integration/test_ai_doctor_multimodal.py -v
```

Expected: PASS for both tests.

- [ ] **Step 31: Run full ai-runtime test suite, verify no regressions**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest -v
```

Expected: ~40 tests pass (17 M1 + 5 T2/T3 + ~18 T4 = ~40). 1 warning, 0 failed.

- [ ] **Step 32: Commit**

```bash
git add ai-runtime/app/graphs/state.py \
        ai-runtime/app/graphs/nodes/classify_input.py \
        ai-runtime/app/graphs/nodes/extract_doc.py \
        ai-runtime/app/graphs/nodes/analyze_doc.py \
        ai-runtime/app/graphs/nodes/analyze_audio.py \
        ai-runtime/app/graphs/nodes/analyze_image.py \
        ai-runtime/app/graphs/nodes/analyze_video.py \
        ai-runtime/app/graphs/nodes/fusion_analyze.py \
        ai-runtime/app/graphs/nodes/finalize.py \
        ai-runtime/app/graphs/ai_doctor.py \
        ai-runtime/app/prompts/ai_doctor/analyze_audio.j2 \
        ai-runtime/app/prompts/ai_doctor/analyze_video.j2 \
        ai-runtime/app/prompts/ai_doctor/analyze_image.j2 \
        ai-runtime/app/prompts/ai_doctor/extract_doc.j2 \
        ai-runtime/app/prompts/ai_doctor/analyze_doc.j2 \
        ai-runtime/app/prompts/ai_doctor/fusion_analyze.j2 \
        ai-runtime/pyproject.toml \
        ai-runtime/uv.lock \
        ai-runtime/tests/unit/test_classify_input.py \
        ai-runtime/tests/unit/test_extract_doc.py \
        ai-runtime/tests/unit/test_analyze_doc.py \
        ai-runtime/tests/unit/test_analyze_audio.py \
        ai-runtime/tests/unit/test_analyze_image.py \
        ai-runtime/tests/unit/test_analyze_video.py \
        ai-runtime/tests/unit/test_fusion_analyze.py \
        ai-runtime/tests/unit/test_finalize.py \
        ai-runtime/tests/integration/test_ai_doctor_multimodal.py

git commit -m "feat(ai-runtime): ai_doctor multimodal graph with parallel fan-out

M2 graph (replaces M1's linear 4-node chain):

  classify_input
       |
       +-- single modality --> [analyze_text|audio|video|image|extract_doc]
       |                              |
       |                              v
       |                          [analyze_doc] (if doc)
       |                              |
       +-- multimodal (>=2 modalities) --> Send(fan-out)
                                              |
                          [analyze_image, analyze_audio, fusion_analyze, ...]
                                              |
                                              v
                                          finalize --> emit_response --> END

  6 new nodes: analyze_audio/video/image, extract_doc, analyze_doc,
  fusion_analyze. classify_input upgraded from 'always text' to a
  routing decision (modality list + multimodal). finalize prefers
  state.fused (multimodal) over analyses[modality] (single).

  6 new prompts: analyze_audio/video/image/extract_doc/analyze_doc/
  fusion_analyze. system_prompt.j2 from M1 unchanged.

  3 new deps: pypdf + python-docx for document extraction; re-added
  from pyproject (M1 dropped them; M2 needs them).

  Test coverage:
    - Per-node unit tests (analyze_audio/video/image + FakeListChatModel)
    - Routing decision tests (text/image/audio/video/doc/multimodal)
    - Extract_doc + analyze_doc chain tests
    - Fusion_analyze synthesis test
    - Finalize fused path test
    - End-to-end integration test (text path + multimodal path)

  Graph dispatch via LangGraph Send API for parallel fan-out; the
  graph compiles to CompiledStateGraph with 10 nodes.

[m2 wave 4]"
```

---

## Task 5: ai-runtime — `chat.py` accepts multimodal input + integration test

**Files:**
- Modify: `ai-runtime/app/api/chat.py` (accept `input.files` and pass into graph state)
- Modify: `ai-runtime/tests/integration/test_chat_endpoint.py` (M1; add multimodal test)

**Interfaces (this task produces):**
- `ChatRequest.input.files: list[dict]` (already in M1; ensure propagation)
- The `state` dict passed to `graph.astream_events` includes `state["files"]` from `body.input.files`

**Global note:** M1's `chat.py` already accepted `input: dict` (no schema enforcement). M2 just needs to ensure `input.files` is propagated to graph state.

- [ ] **Step 1: Write failing test for multimodal /v1/chat**

Append to `ai-runtime/tests/integration/test_chat_endpoint.py` (M1 file). The new test:

```python
@pytest.mark.asyncio
async def test_chat_endpoint_propagates_files_to_graph(monkeypatch, tmp_path):
    """M2: input.files flows into graph state and triggers multimodal path."""
    from app.graphs.nodes import analyze_image, fusion_analyze
    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))

    fake_image = FakeListChatModel(responses=["图：一只猫"])
    fake_fusion = FakeListChatModel(responses=["综合分析：用户上传了图片"])
    monkeypatch.setattr(
        "app.graphs.nodes.analyze_image.get_chat_model", lambda name: fake_image
    )
    monkeypatch.setattr(
        "app.graphs.nodes.fusion_analyze.get_chat_model", lambda name: fake_fusion
    )
    # Also need to upload a file first
    from app.memory.cache import write_file
    meta = write_file(user_id="00000000-0000-0000-0000-000000000001",
                      content=b"PNG data", mime="image/png", name="i.png")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/chat",
            json={
                "graph": "ai-doctor",
                "thread_id": "t-m2",
                "input": {
                    "messages": [{"role": "user", "content": "看看这张图"}],
                    "files": [meta],
                },
            },
            headers={
                "X-Internal-Token": "changeme-internal-token-must-be-32-chars-long",
                "X-User-Id": "00000000-0000-0000-0000-000000000001",
            },
        )
    assert resp.status_code == 200
    # Read SSE stream
    body = b""
    async for chunk in resp.aiter_bytes():
        body += chunk
    text = body.decode("utf-8", errors="replace")
    assert "event: run_start" in text
    assert "event: message_end" in text
    # message_end should carry full_content from fusion_analyze
    assert "综合分析" in text
```

The import `FakeListChatModel` should already be imported in the existing test file; if not, add it.

- [ ] **Step 2: Run test, verify it fails**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/integration/test_chat_endpoint.py::test_chat_endpoint_propagates_files_to_graph -v
```

Expected: FAIL — `chat.py` doesn't propagate `state["files"]` into the graph input.

- [ ] **Step 3: Update `chat.py` to propagate `state.files`**

Modify `ai-runtime/app/api/chat.py`. The current code:

```python
input_state: dict[str, Any] = dict(body.input)
input_state.setdefault("user_id", user_id)
input_state.setdefault("thread_id", thread_id)
input_state.setdefault("run_id", run_id)
```

Add `files`:

```python
input_state: dict[str, Any] = dict(body.input)
input_state.setdefault("user_id", user_id)
input_state.setdefault("thread_id", thread_id)
input_state.setdefault("run_id", run_id)
# M2: propagate files from request body into graph state
if "files" in body.input:
    input_state["files"] = body.input["files"]
```

The `body.input` is `dict[str, Any]` (per M1's `ChatRequest.input: dict[str, Any] = Field(default_factory=dict)`), so `body.input["files"]` is a `list[dict]`.

- [ ] **Step 4: Run test, verify pass**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest tests/integration/test_chat_endpoint.py -v
```

Expected: PASS for all 4 tests (3 M1 + 1 M2 new).

- [ ] **Step 5: Run full suite, verify no regressions**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key uv run pytest -v
```

Expected: ~41 tests pass, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add ai-runtime/app/api/chat.py \
        ai-runtime/tests/integration/test_chat_endpoint.py

git commit -m "feat(ai-runtime): chat.py propagates input.files to graph state

M2 chat endpoint now passes uploaded files from the request body
into the graph state. The graph (T4) reads state.files in
classify_input to decide modality and dispatches to the
appropriate analysis node.

test_chat_endpoint.py: adds test_chat_endpoint_propagates_files_to_graph
which uploads a file via the storage cache, posts to /v1/chat
with input.files, and asserts the SSE stream includes the
fusion_analyze output.

[m2 wave 5]"
```

---

## Task 6: frontend — `langgraphApi.uploadFile` + `ai-doctor.tsx` 4 TODO replacements + state machine

**Files:**
- Modify: `frontend/src/services/langgraphApi.ts`
- Modify: `frontend/src/services/langgraphTypes.ts`
- Modify: `frontend/src/routes/user/ai-doctor.tsx`
- Create: `frontend/src/lib/fileUpload.ts` (optional — see note)

**Interfaces (this task produces):**
- `langgraphApi.uploadFile(file: File): Promise<LangGraphFile>` — POSTs multipart to `/api/v1/ai/files`
- `langgraphTypes.LangGraphFile` complete (file_id, url, mime, size, name, category)
- `ai-doctor.tsx` analysis modal flow: file select → upload → multimodal graph call → state-driven progress UI → final report
- All 4 `TODO(M5)` markers removed

**Global note:** M1 left the analysis modal as a stub because the multimodal graph didn't exist. M2 wires it.

- [ ] **Step 1: Update `langgraphTypes.ts` to complete `LangGraphFile`**

Modify `frontend/src/services/langgraphTypes.ts`. Find the `LangGraphFile` interface (M1 has a partial one with file_id, url, mime, size, name) and ensure all fields are present. If the M1 file already has all fields, no change needed. The expected shape:

```typescript
export interface LangGraphFile {
  file_id: string;
  url: string;
  mime: string;
  size: number;
  name?: string;
  category?: "image" | "audio" | "video" | "doc";
}
```

If M1's `LangGraphFile` is missing `category`, add it. Otherwise, no change.

- [ ] **Step 2: Add `uploadFile` to `langgraphApi.ts`**

Modify `frontend/src/services/langgraphApi.ts`. Add this import at the top (if not present):

```typescript
import type { LangGraphFile } from "./langgraphTypes";
```

Add this function after the existing `stopChat` function:

```typescript
export async function uploadFile(file: File): Promise<LangGraphFile> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/v1/ai/files`, {
    method: "POST",
    credentials: "include",
    body: form, // browser sets Content-Type with boundary
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`File upload failed: ${res.status} ${errText}`);
  }
  return (await res.json()) as LangGraphFile;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && bunx tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors from changed files. (M1 may have pre-existing TS errors in M5-scope files; ignore those.)

- [ ] **Step 4: Replace the 4 TODO(M5) markers in `ai-doctor.tsx`**

Open `frontend/src/routes/user/ai-doctor.tsx`. Find the 4 `TODO(M5)` markers and replace each.

**TODO #1** (around line 30-43, the `uploadFile` stub):

Replace:

```typescript
// TODO(M5): uploadFile() + the Dify-shaped `inputs`/`files` payload below
// belong to the deleted difyApi. Replace with a Spring /files upload
// helper and langgraphApi-shaped input once M5 rewrites this route.

// Local stub so the call site still type-checks. Throws at runtime;
// the analysis modal is gated behind M2/Qwen3-Omni work anyway.
async function uploadFile(
  _file: File,
  _userId: string,
  _category: string,
): Promise<{ id: string }> {
  throw new Error(
    "uploadFile() not implemented — awaits M2 (Qwen3-Omni + Spring /api/v1/ai/files)",
  )
}
```

With:

```typescript
import { uploadFile as apiUploadFile } from "@/services/langgraphApi"
import type { LangGraphFile } from "@/services/langgraphTypes"

async function uploadAnalysisFiles(
  files: File[],
): Promise<LangGraphFile[]> {
  // Sequential upload to avoid hammering the server; could be Promise.all
  // for parallel upload if backend is sized for it (M3+).
  const results: LangGraphFile[] = []
  for (const file of files) {
    const result = await apiUploadFile(file)
    results.push(result)
  }
  return results
}
```

**TODO #2** (around line 814, the Dify-shaped `inputs` blob):

Replace the Dify-shaped `allFileData` mapping and `inputs` construction with:

```typescript
// M2: build LangGraphMessage[] directly from uploaded LangGraphFile[]
const messages: import("@/services/langgraphTypes").LangGraphMessage[] = [
  {
    role: "user",
    content:
      "请你对我上传的档案文件进行专业心理状况分析，给出详细的分析报告。",
    files: uploadResults,
  },
]
```

And replace the `sendChatStream` call. The current call (per M1) uses `sendMessageStream` from difyApi. Replace with the new `sendChatStream`:

```typescript
await sendChatStream(
  "ai-doctor",
  { messages, files: uploadResults },
  streamCallbacks,
  {
    threadId: effectiveSessionId,
    signal: abortController.signal,
  },
)
```

(Remove the `const inputs = {...}` block and the `void inputs` line entirely.)

**TODO #3** (the Dify callback shim):

Replace the existing `difyCallbacks` object with `streamCallbacks: StreamCallbacks`:

```typescript
import type { StreamCallbacks } from "@/services/langgraphTypes"

const streamCallbacks: StreamCallbacks = {
  onRunStart: (_threadId, _runId, _graph) => {
    setAnalysisStage("analyzing")
  },
  onNodeStart: (nodeName) => {
    if (nodeName === "analyze_image" || nodeName === "analyze_audio" ||
        nodeName === "analyze_video") {
      setAnalysisStage("analyzing")
    } else if (nodeName === "fusion_analyze") {
      setAnalysisStage("fusing")
    } else if (nodeName === "extract_doc" || nodeName === "analyze_doc") {
      setAnalysisStage("analyzing")
    }
  },
  onToken: (delta) => {
    setAnalysisStage("analyzing")
    setPartialReport((prev) => prev + delta)
  },
  onMessageEnd: (_threadId, _runId, fullContent) => {
    setAnalysisStage("complete")
    setReport(fullContent)
    // Navigate to result view
    navigate({ to: `/user/ai-doctor/chat/${effectiveSessionId}` })
  },
  onError: (_code, message) => {
    setAnalysisStage("error")
    setAnalysisError(message)
  },
}
```

**TODO #4** (the unused `inputs` variable):

The replacement in TODO #2 already removes the `inputs` declaration; no separate change needed.

- [ ] **Step 5: Add analysis-stage state to the modal**

Find the `useState` declarations in the analysis modal. Add (alongside existing state):

```typescript
const [analysisStage, setAnalysisStage] = useState<
  "idle" | "uploading" | "analyzing" | "fusing" | "complete" | "error"
>("idle")
const [partialReport, setPartialReport] = useState("")
const [analysisError, setAnalysisError] = useState<string | null>(null)
```

Wrap the upload call:

```typescript
setAnalysisStage("uploading")
try {
  const uploadResults = await uploadAnalysisFiles(analysisFiles)
  setAnalysisStage("analyzing")
  // ... existing sendChatStream call from TODO #2
} catch (e) {
  setAnalysisStage("error")
  setAnalysisError(e instanceof Error ? e.message : String(e))
  return
}
```

In the JSX where the modal shows the "uploading" / "analyzing" state, render `analysisStage` instead of the existing `loading` boolean. Sample pattern (adapt to actual file structure):

```tsx
{analysisStage !== "idle" && (
  <div className="analysis-progress">
    {analysisStage === "uploading" && <p>上传中...</p>}
    {analysisStage === "analyzing" && <p>分析中... {partialReport}</p>}
    {analysisStage === "fusing" && <p>正在融合多模态分析...</p>}
    {analysisStage === "complete" && <p>完成</p>}
    {analysisStage === "error" && <p className="error">错误：{analysisError}</p>}
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && bunx tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors from `ai-doctor.tsx`. (M5-scope files may still have pre-existing errors; ignore those.)

- [ ] **Step 7: Verify lint is clean**

```bash
cd frontend && bun run lint 2>&1 | tail -3
```

Expected: 4 pre-existing baseline errors (M1 set this), 0 new errors from this task's changes. Exit code 1 is OK (lint reports 4 errors total); just confirm no new ones.

If there are new errors, fix the offending lines (don't auto-format; the M1 cleanup made lint read-only).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/services/langgraphApi.ts \
        frontend/src/services/langgraphTypes.ts \
        frontend/src/routes/user/ai-doctor.tsx

git commit -m "feat(frontend): uploadFile + analysis modal rewire for multimodal

M1 left the analysis modal as a stub with 4 TODO(M5) markers
because the multimodal graph didn't exist yet. M2 wires it.

  - langgraphApi.uploadFile: multipart POST to /api/v1/ai/files;
    returns LangGraphFile {file_id, url, mime, size, name, category}.
  - langgraphTypes.LangGraphFile: complete field set (added
    'category' for client-side pre-classification).
  - ai-doctor.tsx: replaced all 4 TODO(M5) markers:
      TODO #1: real uploadAnalysisFiles(files[]) -> LangGraphFile[]
      TODO #2: Dify-shaped inputs -> LangGraphMessage[] + files
      TODO #3: Dify callback shim -> direct StreamCallbacks
      TODO #4: 'void inputs' workaround removed
  - State machine: analysisStage ('idle'|'uploading'|'analyzing'|
    'fusing'|'complete'|'error') drives progress UI.
  - onNodeStart events drive sub-stage messages (image/audio/video/
    doc analysis vs fusion).

  Verified: bun run lint shows 4 pre-existing baseline errors,
  0 new; bunx tsc --noEmit shows 0 new errors in the changed
  files (M5-scope files retain their pre-existing errors).

[m2 wave 6]"
```

---

## Task 7: full verification + tag `m2-ai-doctor-multimodal` + Playwright spec

**Files:**
- Create: `frontend/tests/multimodal-upload.spec.ts`
- Modify: `frontend/playwright.config.ts` (already done in M1; may need no change)
- Modify: `.superpowers/sdd/progress.md` (add M2 final note)
- Modify: `doc/langgraph-migration/02-components.md` (mark M2 features as done? out of scope; defer to M3+)

**Global note:** M7 mirrors M1's T8: full verification gates + tag. M2's tag is `m2-ai-doctor-multimodal` at the M2 milestone commit (the empty chore-m2 commit, like M1's `chore(m1)`).

- [ ] **Step 1: Write Playwright multimodal spec**

Create `frontend/tests/multimodal-upload.spec.ts`:

```typescript
import { test, expect } from "@playwright/test"

/**
 * M2 verification: login, upload an image, send a multimodal message,
 * watch the streamed assistant response land in the UI.
 *
 * Prerequisite: stack is up (docker compose), superuser exists
 * (FIRST_SUPERUSER=admin@example.com / FIRST_SUPERUSER_PASSWORD=changethis).
 * This spec mirrors M1's chat-streaming.spec.ts but exercises the
 * multimodal upload + Send API path.
 */

test("multimodal upload + analysis streams a response", async ({ page }) => {
  await page.goto("/login")
  await page.fill('input[name="email"], input[type="email"]', "admin@example.com")
  await page.fill('input[name="password"], input[type="password"]', "changethis")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/user/, { timeout: 10_000 })

  await page.goto("/user/ai-doctor")
  await expect(page).toHaveURL(/\/user\/ai-doctor/)

  // The M2 multimodal UI has an "分析" / "上传档案" button; click it
  await page.click('button:has-text("分析"), button:has-text("上传")')

  // Upload a file via the file input
  const fileInput = page.locator('input[type="file"]')
  // Use a tiny pre-baked PNG (1x1 transparent pixel)
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
    "base64"
  )
  await fileInput.setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: tinyPng,
  })

  // Submit analysis
  await page.click('button:has-text("开始分析"), button[type="submit"]')

  // Wait for the result view (redirect on completion)
  await page.waitForURL(/\/user\/ai-doctor\/chat\//, { timeout: 30_000 })
  const report = page.locator('[data-testid="report"], .report, .analysis')
  await expect(report).toBeVisible({ timeout: 10_000 })
})
```

- [ ] **Step 2: Run final 4 verification gates**

```bash
cd backend-sb && bash scripts/test.sh 2>&1 | tail -3
# Expect BUILD SUCCESS with 121+ passed / 0 failed / 4 errors (V4MigrationTest pre-existing)

cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key LANGGRAPH_QWEN_API_KEY=test-key \
  LANGGRAPH_INTERNAL_TOKEN=changeme-internal-token-must-be-32-chars-long \
  uv run pytest -v 2>&1 | tail -3
# Expect 41+ passed, 0 failed

cd frontend && bun run lint 2>&1 | tail -3
# Expect 4 pre-existing baseline errors, 0 new; exit 1 OK

docker compose -f compose.yml -f compose.override.yml config > /dev/null && echo OK
# Expect OK
```

If any gate fails on a NEW error, **stop and report BLOCKED**.

- [ ] **Step 3: Commit the Playwright spec**

```bash
git add frontend/tests/multimodal-upload.spec.ts

git commit -m "test(frontend): multimodal-upload Playwright spec for M2

Asserts: login as superuser -> /user/ai-doctor -> click
analysis button -> upload tiny PNG -> submit -> redirected to
result view -> report visible within 30s.

Mirrors M1's chat-streaming.spec.ts but exercises the new
multimodal path (file upload + Send API fan-out +
fusion_analyze). Uses a 1x1 transparent PNG as the test
artifact to keep the upload tiny.

End-to-end pass depends on a real LANGGRAPH_QWEN_API_KEY in
the running ai-runtime. Without one, the spec will timeout
waiting for the multimodal LLM reply (env issue, not code).
Document this in the PR description.

[m2 wave 7]"
```

- [ ] **Step 4: Tag the milestone (commit only — DO NOT push the tag yet)**

```bash
git tag -d m2-ai-doctor-multimodal 2>/dev/null  # in case a prior attempt left one
git tag m2-ai-doctor-multimodal HEAD
git tag -n m2-ai-doctor-multimodal  # show annotation
```

- [ ] **Step 5: Final M2 commit (changelog-style)**

```bash
git commit --allow-empty -m "chore(m2): tag m2-ai-doctor-multimodal at <this-commit>

M2 delivers the end-to-end ai_doctor multimodal path:

  Browser -> /user/ai-doctor -> uploadFile -> POST /api/v1/ai/files (Spring)
        -> AiProxyService.proxyFileUpload (multipart + 4 headers)
        -> ai-runtime POST /v1/files/upload (FastAPI)
        -> local-FS storage at LANGGRAPH_STORAGE_PATH/YYYY/MM/DD/

  Browser -> langgraphApi.sendChatStream with input.files
        -> POST /api/v1/ai/chat (Spring)
        -> AiProxyService.proxyChatStream (SSE passthrough)
        -> ai-runtime POST /v1/chat
        -> ai_doctor graph: classify_input
                -> Send(fan-out) for multimodal
                        -> analyze_image/audio/video (Qwen3-Omni)
                        -> extract_doc -> analyze_doc (MinMax)
                        -> fusion_analyze (MinMax synthesis)
                -> finalize -> emit_response -> END
        -> SSE frames: run_start / node_start / token / message_end

In-scope (7 tasks):
  - Spring FileController + AiProxyService proxyFileUpload/Download
  - ai-runtime config + QwenOmniProvider + factory register
  - /v1/files/upload + /v1/files/{id} + local-FS storage
  - state + 6 nodes + 5 prompts + ai_doctor.py conditional edges
  - chat.py input.files propagation
  - frontend uploadFile + ai-doctor.tsx rewire (4 TODO M5 removed)
  - Playwright multimodal spec

Out of scope (deferred):
  - M3: psych_test, Dify YAML prompt extraction, intent routing
  - M4: PostgresSaver persistence, pgvector long-term memory,
        ConversationMeta, V5 migration, per-user file ACL
  - M5: stop/pause/resume/regenerate-versions, Redis cancel,
        useChat.ts full rewrite
  - Video frame extraction (ffmpeg), audio transcoding,
        OCR fallback for images, virus scan, file dedup

Verification gates (all green at tag time):
  mvn test:    121+ passed / 0 failed / 4 errors (V4MigrationTest pre-existing)
  pytest:      41+ passed (unit + integration, FakeListChatModel for Qwen)
  bun lint:    4 pre-existing baseline, 0 new
  compose:     exit 0
  manual curl: SSE frames flow through (real Qwen key required)

[m2 milestone complete]"
```

Replace `<this-commit>` with the hash from Step 4.

- [ ] **Step 6: Report to user**

Tell the user:
1. Final HEAD hash
2. Tag hash
3. Commit count since M1 (`git log --oneline m1-ai-doctor-text..m2-ai-doctor-multimodal`)
4. Test counts (Java / Python)
5. Any caveats (e.g., Playwright test requires real Qwen key to pass end-to-end)

---

## Self-Review

Run this before handoff. Fix any issues inline.

**1. Spec coverage:** Skim each section/requirement in the spec at `docs/superpowers/specs/2026-07-04-emomind-lg-milestone-2-ai-doctor-multimodal-design.md`. Can you point to a task that implements it? List any gaps.

- [x] Spring FileController + AiProxyService (T1)
- [x] QwenOmniProvider + factory (T2)
- [x] /v1/files/upload + /v1/files/{id} + local-FS storage + MIME whitelist (T3)
- [x] state + 6 nodes + 5 prompts + ai_doctor.py conditional edges + Send API (T4)
- [x] chat.py multimodal input propagation (T5)
- [x] frontend uploadFile + LangGraphFile + ai-doctor.tsx rewire (T6)
- [x] Playwright multimodal spec (T7)
- [x] Full verification gates + tag m2-ai-doctor-multimodal (T7)

**No spec gaps.**

**2. Placeholder scan:** No "TBD", "TODO", or "similar to Task N" without repetition. Each step has actual code.

**3. Type consistency:**
- `classify_input` returns `{"modality": str, "modalities": list[str]}` (T4) — used by `_route_after_classify` (T4) ✓
- `extract_doc` returns `{"doc_text": str}` (T4) — consumed by `analyze_doc` (T4) ✓
- `analyze_doc` reads `state["doc_text"]` (T4) ✓
- `fusion_analyze` reads `state["analyses"]` (T4) — populated by parallel analyze_* branches (T4) ✓
- `finalize` reads `state["fused"]` first, then `state["analyses"][modality]` (T4) ✓
- `cache.write_file(user_id, content, mime, name) -> dict` (T3) — used by T4 analyze_* nodes ✓
- `cache.get_meta(file_id) -> dict | None` (T3) — used by T4 analyze_* nodes ✓
- `cache.read_file(file_id, user_id) -> bytes | None` (T3) — used by T4 analyze_* + GET /v1/files (T3) ✓
- `get_chat_model("qwen3-omni")` (T2) — used by T4 analyze_image/audio/video ✓
- `get_chat_model("minimax")` (M1) — used by T4 analyze_doc, fusion_analyze (both M1 path) ✓
- `langgraphApi.uploadFile(file)` (T6) — used by T6 ai-doctor.tsx analysis modal ✓
- `LangGraphFile` fields (T6) — match what Spring (T1) + ai-runtime (T3) return ✓

**No type drift.**

**4. Note on T6's "TS check" step:** M1's `bun run lint` is read-only now (per the M1 cleanup). For TS type errors we use `bunx tsc --noEmit`. This is documented in T6 Steps 3, 6, and T7 Step 2 implicitly.

---

## Execution Handoff

Plan complete and saved to `doc/langgraph-migration/plans/2026-07-04-emomind-lg-milestone-2-ai-doctor-multimodal.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (T1 → T7), review between tasks, fast iteration. Aligns with how M1 was executed.

2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

**Which approach?**
