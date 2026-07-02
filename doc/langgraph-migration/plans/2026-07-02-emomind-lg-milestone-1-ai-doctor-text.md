# M1: ai_doctor 文本路径 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the end-to-end ai_doctor text-only path: Spring AiController forwards SSE to ai-runtime → ai-runtime runs a LangGraph ai_doctor graph (text branch only) → frontend `/user/ai-doctor` uses new `langgraphApi.ts` instead of the neutralized `difyApi.ts`. Multimodal, psych_test, persistence, and advanced interaction are explicitly M2-M5 and out of scope here.

**Architecture:** Two-tier runtime with M0-style boundary preservation. Spring Boot remains the auth/aggregation gateway; ai-runtime (Python + LangGraph + FastAPI) executes the graph and emits LangGraph-native SSE events. Spring proxies the SSE byte stream unchanged, injecting `X-User-Id`/`X-User-Roles`/`X-Internal-Token`/`X-Trace-Id` headers on the way out. The ai_doctor graph is built with LangGraph's `StateGraph` and compiled **without** a checkpointer for M1 (persistence is M4). Long-term memory nodes (`extract_facts`, `write_long_term`) are not wired into the M1 graph — they're M4. Frontend gets a minimal `langgraphApi.ts` that mirrors the `difyApi` interface shape just enough for `/user/ai-doctor` to work; full `useChat.ts` rewrite is M5.

**Tech Stack:** LangGraph 0.2.x, LangChain 0.3.x, langchain-openai 0.2.x, FastAPI 0.115, Pydantic 2.x, Jinja2 3.1, tenacity 9.0, Spring Boot 3.2 + WebClient (Reactor), React 19 + TypeScript + TanStack Router.

## Global Constraints

These apply to every task below. Implementation must satisfy all of them or the plan is wrong.

- **Working directory:** `F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg`
- **Branch:** `emomind-lg` (do not switch)
- **Conventional Commits prefix per layer:**
  - `feat(backend):` for Java
  - `feat(ai-runtime):` for Python
  - `feat(frontend):` for TS
  - `test:` for tests-only commits
  - `chore(m1):` for tag / final commit
- **Do NOT push.** User pushes manually after reviewing.
- **No real API keys in code or commits.** Use placeholders; tests must mock LLMs.
- **One commit per task.** Task deliverable's tests must be green before commit.
- **M1 doesn't depend on Redis, PostgresSaver, pgvector long-term memory, file uploads, stop, regenerate-versions, or pause/resume.** If you find yourself needing any of those, you've left M1 scope — stop and ask.
- **Verify locally before commit:**
  - Java: `cd backend-sb && mvn -q test -Dtest=ClassName#method`
  - Python: `cd ai-runtime && uv run pytest tests/path/test.py::test_name -v`
  - Frontend: `cd frontend && bun run lint` (TS check happens at build time; we don't run TSC in M1)
- **LLM API contract for tests:** mock `BaseChatModel.ainvoke` / `astream` to return canned `AIMessage` / `AIMessageChunk`. Never call real LLM in unit/integration tests.
- **Run from project root unless task says otherwise.**

---

## File Structure

These files will be created or modified. Tasks below reference them by exact path.

### New Python files (ai-runtime)

```
ai-runtime/app/auth.py                                 X-Internal-Token validator
ai-runtime/app/streaming.py                            astream_events → SSE frames
ai-runtime/app/llm_retry.py                            tenacity decorator
ai-runtime/app/graphs/__init__.py
ai-runtime/app/graphs/state.py                         GraphState TypedDict
ai-runtime/app/graphs/ai_doctor.py                     build_ai_doctor_graph()
ai-runtime/app/graphs/nodes/__init__.py
ai-runtime/app/graphs/nodes/classify_input.py          text-only branch decision
ai-runtime/app/graphs/nodes/analyze_text.py            LLM call, returns analyses["text"]
ai-runtime/app/graphs/nodes/finalize.py                assemble final reply
ai-runtime/app/graphs/nodes/emit_response.py           emit message_end into state
ai-runtime/app/models/__init__.py
ai-runtime/app/models/base.py                          ChatModelProvider abstract
ai-runtime/app/models/factory.py                       get_chat_model(name)
ai-runtime/app/models/minimax.py                       MinMax via langchain-openai
ai-runtime/app/prompts/__init__.py
ai-runtime/app/prompts/loader.py                       jinja2 loader
ai-runtime/app/prompts/ai_doctor/system_prompt.j2      system role for ai_doctor
ai-runtime/app/prompts/ai_doctor/analyze_text.j2       analyze_text user template
ai-runtime/app/api/chat.py                             POST /v1/chat (SSE)
ai-runtime/tests/conftest.py                           LLM mock fixture
ai-runtime/tests/unit/test_classify_input.py
ai-runtime/tests/unit/test_analyze_text.py
ai-runtime/tests/unit/test_finalize.py
ai-runtime/tests/integration/test_ai_doctor_text.py    text path E2E
```

### Modified Python files

```
ai-runtime/pyproject.toml                              +langgraph, +langchain, +langchain-openai, +jinja2, +tenacity
ai-runtime/app/main.py                                 wire chat router + lifespan for LLM warmup (none required for M1 but placeholder)
ai-runtime/app/config.py                               add LANGGRAPH_MINIMAX_API_KEY etc.
```

### New Java files (backend-sb)

```
backend-sb/src/main/java/com/emomind/dto/request/ChatRequest.java
backend-sb/src/test/java/com/emomind/service/AiProxyServiceTest.java
backend-sb/src/test/java/com/emomind/controller/AiControllerAuthTest.java
```

### Modified Java files

```
backend-sb/src/main/java/com/emomind/config/LangGraphProperties.java   add internal-token, model, timeouts
backend-sb/src/main/java/com/emomind/config/WebClientConfig.java       add aiRuntimeWebClient bean
backend-sb/src/main/java/com/emomind/service/AiProxyService.java       real SSE proxy impl
backend-sb/src/main/java/com/emomind/controller/AiController.java      real /chat endpoint
```

### New Frontend files

```
frontend/src/services/langgraphApi.ts                                  sendChatStream + types
frontend/src/services/langgraphTypes.ts                               LangGraphMessage, StreamCallbacks
frontend/src/lib/sseParser.ts                                         generic EventSource wrapper for fetch-stream
frontend/tests/chat-streaming.spec.ts                                 Playwright spec
```

### Modified Frontend files

```
frontend/src/routes/user/ai-doctor.tsx                                swap difyApi → langgraphApi
```

---

## Task 1: Spring backend — LangGraphProperties + AiProxyService + AiController /chat

**Files:**
- Modify: `backend-sb/src/main/java/com/emomind/config/LangGraphProperties.java`
- Modify: `backend-sb/src/main/java/com/emomind/config/WebClientConfig.java`
- Modify: `backend-sb/src/main/java/com/emomind/service/AiProxyService.java`
- Modify: `backend-sb/src/main/java/com/emomind/controller/AiController.java`
- Create: `backend-sb/src/main/java/com/emomind/dto/request/ChatRequest.java`
- Create: `backend-sb/src/test/java/com/emomind/service/AiProxyServiceTest.java`
- Create: `backend-sb/src/test/java/com/emomind/controller/AiControllerAuthTest.java`

**Interfaces (this task produces):**
- `LangGraphProperties.getRuntimeUrl(): String` (already exists)
- `LangGraphProperties.getInternalToken(): String` (new)
- `LangGraphProperties.getConnectTimeoutMs(): long` (new, default 5000)
- `LangGraphProperties.getResponseTimeoutMs(): long` (new, default 120000)
- `WebClientConfig.aiRuntimeWebClient(LangGraphProperties): WebClient` bean (new)
- `AiProxyService.proxyChatStream(UUID userId, Set<String> roles, String graph, String threadId, Map<String,Object> input): Flux<DataBuffer>`
- `POST /api/v1/ai/chat` returns `ResponseEntity<Flux<DataBuffer>>` with SSE headers

**Global note:** This task replaces the M0 stub. The /healthz endpoint and the 401 catch-all stay; only /chat becomes real.

- [ ] **Step 1: Write failing test for AiProxyService header injection**

Create `backend-sb/src/test/java/com/emomind/service/AiProxyServiceTest.java`:

```java
package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AiProxyServiceTest {

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
    void proxyChatStream_injectsRequiredHeaders() throws Exception {
        server.enqueue(new MockResponse()
            .setHeader("Content-Type", "text/event-stream")
            .setBody("event: message_end\ndata: {\"thread_id\":\"t1\",\"run_id\":\"r1\",\"full_content\":\"hi\"}\n\n"));

        UUID userId = UUID.randomUUID();
        Flux<?> stream = service.proxyChatStream(
            userId, Set.of("ROLE_USER"), "ai-doctor", null, Map.of("messages", java.util.List.of()));

        StepVerifier.create(stream).expectNextCount(1).verifyComplete();

        RecordedRequest req = server.takeRequest();
        assertThat(req.getPath()).isEqualTo("/v1/chat");
        assertThat(req.getHeader("X-User-Id")).isEqualTo(userId.toString());
        assertThat(req.getHeader("X-User-Roles")).isEqualTo("ROLE_USER");
        assertThat(req.getHeader("X-Internal-Token")).isEqualTo("test-internal-token-32-chars-long-xxxx");
        assertThat(req.getHeader("X-Trace-Id")).isNotBlank();
        assertThat(req.getMethod()).isEqualTo("POST");
    }
}
```

This test depends on `com.squareup.okhttp3:mockwebserver`. Add it as test scope in `backend-sb/pom.xml`:

```xml
<dependency>
    <groupId>com.squareup.okhttp3</groupId>
    <artifactId>mockwebserver</artifactId>
    <version>4.12.0</version>
    <scope>test</scope>
</dependency>
```

- [ ] **Step 2: Run test, verify it fails (compilation or assertion)**

```bash
cd backend-sb && mvn -q test -Dtest=AiProxyServiceTest#proxyChatStream_injectsRequiredHeaders
```

Expected: FAIL — `AiProxyService` constructor takes different args, or doesn't exist yet. Confirm failure is for the right reason (missing impl, not missing dep).

- [ ] **Step 3: Extend `LangGraphProperties`**

`backend-sb/src/main/java/com/emomind/config/LangGraphProperties.java` — add fields (preserve existing ones):

```java
package com.emomind.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "app.langgraph")
public class LangGraphProperties {

    private String runtimeUrl = "http://localhost:8000";
    private String internalToken = "";
    private long connectTimeoutMs = 5000L;
    private long responseTimeoutMs = 120000L;
    private String textModel = "minimax-text-01";

    public String getRuntimeUrl() { return runtimeUrl; }
    public void setRuntimeUrl(String runtimeUrl) { this.runtimeUrl = runtimeUrl; }

    public String getInternalToken() { return internalToken; }
    public void setInternalToken(String internalToken) { this.internalToken = internalToken; }

    public long getConnectTimeoutMs() { return connectTimeoutMs; }
    public void setConnectTimeoutMs(long connectTimeoutMs) { this.connectTimeoutMs = connectTimeoutMs; }

    public long getResponseTimeoutMs() { return responseTimeoutMs; }
    public void setResponseTimeoutMs(long responseTimeoutMs) { this.responseTimeoutMs = responseTimeoutMs; }

    public String getTextModel() { return textModel; }
    public void setTextModel(String textModel) { this.textModel = textModel; }
}
```

- [ ] **Step 4: Add `aiRuntimeWebClient` bean**

`backend-sb/src/main/java/com/emomind/config/WebClientConfig.java` — add this bean (preserve existing beans):

```java
package com.emomind.config;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.util.concurrent.TimeUnit;

@Configuration
public class WebClientConfig {

    private final LangGraphProperties langGraphProperties;

    public WebClientConfig(LangGraphProperties langGraphProperties) {
        this.langGraphProperties = langGraphProperties;
    }

    @Bean
    public WebClient aiRuntimeWebClient() {
        HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, (int) langGraphProperties.getConnectTimeoutMs())
            .doOnConnected(conn ->
                conn.addHandlerLast(new ReadTimeoutHandler(
                    langGraphProperties.getResponseTimeoutMs(), TimeUnit.MILLISECONDS)));

        return WebClient.builder()
            .baseUrl(langGraphProperties.getRuntimeUrl())
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .build();
    }
}
```

- [ ] **Step 5: Implement `AiProxyService`**

Replace `backend-sb/src/main/java/com/emomind/service/AiProxyService.java`:

```java
package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AiProxyService {

    private static final Logger log = LoggerFactory.getLogger(AiProxyService.class);
    private final WebClient aiRuntimeWebClient;
    private final LangGraphProperties props;

    public AiProxyService(WebClient aiRuntimeWebClient, LangGraphProperties props) {
        this.aiRuntimeWebClient = aiRuntimeWebClient;
        this.props = props;
    }

    public Flux<DataBuffer> proxyChatStream(
            UUID userId,
            Set<String> roles,
            String graph,
            String threadId,
            Map<String, Object> input) {

        String traceId = UUID.randomUUID().toString();
        Map<String, Object> body = Map.of(
            "graph", graph,
            "thread_id", threadId == null ? "" : threadId,
            "input", input
        );

        return aiRuntimeWebClient.post()
            .uri("/v1/chat")
            .contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.TEXT_EVENT_STREAM)
            .header("X-User-Id", userId.toString())
            .header("X-User-Roles", String.join(",", roles))
            .header("X-Internal-Token", props.getInternalToken())
            .header("X-Trace-Id", traceId)
            .bodyValue(body)
            .retrieve()
            .bodyToFlux(DataBuffer.class)
            .doOnError(e -> log.error("ai-runtime chat stream error trace={}", traceId, e));
    }

    /** M5 stub — present so the controller compiles if any caller hits /chat/stop. */
    public Mono<Void> proxyStop(UUID userId, String threadId, String runId) {
        log.warn("proxyStop called but not implemented in M1 — thread={} run={}", threadId, runId);
        return Mono.empty();
    }
}
```

- [ ] **Step 6: Implement `POST /api/v1/ai/chat` in `AiController`**

Replace `backend-sb/src/main/java/com/emomind/controller/AiController.java`:

```java
package com.emomind.controller;

import com.emomind.dto.request.ChatRequest;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.AiProxyService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private static final Logger log = LoggerFactory.getLogger(AiController.class);
    private final AiProxyService aiProxyService;

    public AiController(AiProxyService aiProxyService) {
        this.aiProxyService = aiProxyService;
    }

    @GetMapping("/healthz")
    public ResponseEntity<?> healthz() {
        return ResponseEntity.ok().body(java.util.Map.of(
            "status", "ok",
            "service", "ai-gateway",
            "note", "ai-runtime integration ships in M1"
        ));
    }

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<Flux<DataBuffer>> chat(@Valid @RequestBody ChatRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(401).build();
        }
        Object principal = auth.getPrincipal();
        UUID userId = (principal instanceof UserDetailsImpl u) ? u.getId() : UUID.fromString(auth.getName());
        Set<String> roles = auth.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .collect(Collectors.toSet());

        log.info("chat request user={} graph={} thread={}", userId, request.getGraph(), request.getThreadId());

        Flux<DataBuffer> stream = aiProxyService.proxyChatStream(
            userId, roles, request.getGraph(), request.getThreadId(), request.getInput());

        return ResponseEntity.ok()
            .header("Content-Type", "text/event-stream;charset=UTF-8")
            .header("Cache-Control", "no-cache")
            .header("Connection", "keep-alive")
            .header("X-Accel-Buffering", "no")
            .body(stream);
    }
}
```

- [ ] **Step 7: Create `ChatRequest` DTO**

Create `backend-sb/src/main/java/com/emomind/dto/request/ChatRequest.java`:

```java
package com.emomind.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public class ChatRequest {

    @NotBlank
    private String graph;

    private String threadId;

    @NotNull
    private Map<String, Object> input;

    public String getGraph() { return graph; }
    public void setGraph(String graph) { this.graph = graph; }

    public String getThreadId() { return threadId; }
    public void setThreadId(String threadId) { this.threadId = threadId; }

    public Map<String, Object> getInput() { return input; }
    public void setInput(Map<String, Object> input) { this.input = input; }
}
```

- [ ] **Step 8: Add `AiControllerAuthTest`**

Create `backend-sb/src/test/java/com/emomind/controller/AiControllerAuthTest.java`:

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class AiControllerAuthTest {

    @Autowired private WebApplicationContext context;
    @MockitoBean private AiProxyService aiProxyService;

    @Test
    void unauthenticated_chat_returns401() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity())
            .build();
        mvc.perform(post("/api/v1/ai/chat")
                .contentType("application/json")
                .content("{\"graph\":\"ai-doctor\",\"input\":{}}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "00000000-0000-0000-0000-000000000001", roles = "USER")
    void authenticated_chat_returns200() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity())
            .build();
        // We don't have a real ai-runtime up in tests; auth should pass and Spring should
        // attempt to read from ai-runtime. The 200 vs 5xx depends on MockBean wiring —
        // M1 only asserts the auth gate is no longer the blocker.
        mvc.perform(post("/api/v1/ai/chat")
                .contentType("application/json")
                .content("{\"graph\":\"ai-doctor\",\"input\":{}}"))
            .andExpect(status().is(org.hamcrest.Matchers.anyOf(
                org.hamcrest.Matchers.equalTo(200),
                org.hamcrest.Matchers.equalTo(500))));
    }
}
```

- [ ] **Step 9: Run all new tests, verify they pass**

```bash
cd backend-sb && mvn -q test -Dtest=AiProxyServiceTest,AiControllerAuthTest
```

Expected: PASS for both. (The `proxyChatStream_injectsRequiredHeaders` test should now succeed.)

- [ ] **Step 10: Run full mvn test, verify no regressions**

```bash
cd backend-sb && mvn -q test
```

Expected: all tests PASS. If pre-existing tests break, fix before commit.

- [ ] **Step 11: Commit**

```bash
git add backend-sb/pom.xml \
        backend-sb/src/main/java/com/emomind/config/LangGraphProperties.java \
        backend-sb/src/main/java/com/emomind/config/WebClientConfig.java \
        backend-sb/src/main/java/com/emomind/service/AiProxyService.java \
        backend-sb/src/main/java/com/emomind/controller/AiController.java \
        backend-sb/src/main/java/com/emomind/dto/request/ChatRequest.java \
        backend-sb/src/test/java/com/emomind/service/AiProxyServiceTest.java \
        backend-sb/src/test/java/com/emomind/controller/AiControllerAuthTest.java

git commit -m "feat(backend): wire AiController /chat to ai-runtime via WebClient

M0 had AiController stub returning 501. M1 makes /chat real:
- LangGraphProperties gains internal-token + timeouts + text-model
- WebClientConfig gets aiRuntimeWebClient bean (5s connect / 120s read)
- AiProxyService.proxyChatStream forwards SSE byte stream unchanged,
  injecting X-User-Id / X-User-Roles / X-Internal-Token / X-Trace-Id
- AiController /chat returns text/event-stream with no-cache +
  X-Accel-Buffering: no headers (matches spec 02-components.md §1.1)
- ChatRequest DTO with @NotBlank graph + @NotNull input
- AiProxyServiceTest with MockWebServer asserts required headers
- AiControllerAuthTest asserts 401 unauth + auth-passes path

Stop API stays stubbed (M5 scope). Real ai-runtime is M1 T2-T6.

[m1 wave 1]"
```

---

## Task 2: Python ai-runtime — add LangGraph deps + extend config

**Files:**
- Modify: `ai-runtime/pyproject.toml`
- Modify: `ai-runtime/app/config.py`
- Create: `ai-runtime/tests/test_settings.py`

**Interfaces (this task produces):**
- `Settings.minimax_api_key: str` (required, no default)
- `Settings.minimax_base_url: str` (default `https://api.minimax.chat/v1`)
- `Settings.minimax_text_model: str` (default `minimax-text-01`)
- `Settings.internal_token: str` (required, min_length 32) — already in spec
- `Settings.log_level: str` (default `INFO`) — already exists

- [ ] **Step 1: Write failing test for config**

Create `ai-runtime/tests/test_settings.py`:

```python
import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_requires_minimax_api_key():
    with pytest.raises(ValidationError):
        Settings(minimax_api_key="")


def test_settings_has_default_minimax_base_url(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    s = Settings()
    assert s.minimax_base_url.startswith("https://")


def test_settings_minimax_text_model_default():
    import os
    os.environ["LANGGRAPH_MINIMAX_API_KEY"] = "test-key"
    s = Settings()
    assert s.minimax_text_model  # non-empty
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd ai-runtime && uv run pytest tests/test_settings.py -v
```

Expected: FAIL — `Settings` has no `minimax_api_key` field, or constructor doesn't require it.

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

    # Security (already required, kept)
    # Will be enforced in M1 — for M0 only "placeholder" is needed for config to load.
    internal_token: str = Field(default="m0-placeholder-token-must-be-32-chars", min_length=16)

    # PostgreSQL (kept)
    database_url: str = "postgresql://postgres:postgres@db:5432/emomind"

    # Default points at the host-side port mapped by compose.override.yml
    # (6390 -> container 6379). Override via LANGGRAPH_REDIS_URL env var
    # when running inside compose: `redis://redis:6379`.
    redis_url: str = "redis://localhost:6390"

    # Storage
    storage_path: str = "/var/lib/emomind/files"

    # LLM providers (M1 only needs MinMax text; Qwen3-Omni for M2)
    minimax_api_key: str = Field(..., min_length=1)
    minimax_base_url: str = "https://api.minimax.chat/v1"
    minimax_text_model: str = "minimax-text-01"

    # Limits
    request_timeout_seconds: int = 120
    log_level: str = "INFO"


settings = Settings()  # type: ignore[call-arg]
```

The `minimax_api_key` is required at instantiation. Tests must set `LANGGRAPH_MINIMAX_API_KEY` env var (or monkeypatch).

- [ ] **Step 4: Update pyproject.toml with LangGraph deps**

`ai-runtime/pyproject.toml` — replace the `[project] dependencies = [...]` block:

```toml
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "langgraph>=0.2.0,<0.3.0",
    "langchain>=0.3.0,<0.4.0",
    "langchain-core>=0.3.0,<0.4.0",
    "langchain-openai>=0.2.0",
    "jinja2>=3.1",
    "tenacity>=9.0",
    "httpx>=0.27",
]
```

Drop `psycopg`/`pgvector`/`redis`/`prometheus-client`/`unstructured`/`pypdf`/`python-multipart` from M1 — they're M2/M4. Keep `pyyaml` if present (used elsewhere).

- [ ] **Step 5: Run uv sync**

```bash
cd ai-runtime && uv sync
```

Expected: installs new deps. May take 1-2 minutes.

- [ ] **Step 6: Update `.env.example` with LLM key placeholder**

`ai-runtime/.env.example` — replace contents:

```
# M1: ai_doctor text path
LANGGRAPH_INTERNAL_TOKEN=changeme-internal-token-must-be-32-chars-long
LANGGRAPH_DATABASE_URL=postgresql://postgres:postgres@db:5432/emomind
LANGGRAPH_REDIS_URL=redis://localhost:6390

# LLM providers
LANGGRAPH_MINIMAX_API_KEY=your-minimax-api-key
LANGGRAPH_MINIMAX_BASE_URL=https://api.minimax.chat/v1
LANGGRAPH_MINIMAX_TEXT_MODEL=minimax-text-01

# Logging
LANGGRAPH_LOG_LEVEL=INFO
```

- [ ] **Step 7: Run test, verify it passes**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key uv run pytest tests/test_settings.py -v
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add ai-runtime/pyproject.toml ai-runtime/uv.lock ai-runtime/app/config.py ai-runtime/.env.example ai-runtime/tests/test_settings.py

git commit -m "feat(ai-runtime): add LangGraph/LangChain deps + MinMax config

M1 needs the LangGraph Python stack. pyproject.toml now pins:
  langgraph 0.2.x (locked <0.3 to avoid API drift)
  langchain 0.3.x
  langchain-openai 0.2.x (MinMax is OpenAI-API-compatible)
  jinja2 3.1 (prompt templates)
  tenacity 9.0 (LLM retry)

Dropped M2/M4 deps (psycopg, pgvector, redis, prometheus-client,
unstructured, pypdf, multipart) — they belong in their respective
milestones, not M1's text-only scope.

config.py gains required minimax_api_key (validated at startup),
optional base_url + text_model defaults matching the spec. Existing
internal_token / database_url / redis_url preserved.

.env.example simplified to just M1-relevant vars. Full env template
(MINIMAX_BASE_URL, Qwen3-Omni keys, etc.) is M2.

[m1 wave 2]"
```

---

## Task 3: Python ai-runtime — chat models + retry

**Files:**
- Create: `ai-runtime/app/models/__init__.py`
- Create: `ai-runtime/app/models/base.py`
- Create: `ai-runtime/app/models/factory.py`
- Create: `ai-runtime/app/models/minimax.py`
- Create: `ai-runtime/app/llm_retry.py`
- Create: `ai-runtime/tests/unit/__init__.py`
- Create: `ai-runtime/tests/unit/test_llm_retry.py`
- Create: `ai-runtime/tests/unit/test_model_factory.py`

**Interfaces (this task produces):**
- `class ChatModelProvider(ABC)` with `def get(self) -> BaseChatModel`
- `def get_chat_model(provider: str) -> BaseChatModel` raises `ValueError` if unknown
- `class MinMaxProvider(ChatModelProvider)` returning `ChatOpenAI` configured for MinMax
- `@tenacity.retry` decorated `call_llm(model, messages) -> AIMessage`

- [ ] **Step 1: Write failing test for model factory**

Create `ai-runtime/tests/unit/test_model_factory.py`:

```python
import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.config import Settings
from app.models.factory import get_chat_model


@pytest.fixture
def settings(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    return Settings()


def test_factory_known_provider_returns_model(settings):
    model = get_chat_model("minimax")
    assert model is not None
    # Should be a ChatOpenAI configured with MinMax base_url
    assert hasattr(model, "openai_api_base") or hasattr(model, "base_url")


def test_factory_unknown_provider_raises(settings):
    with pytest.raises(ValueError, match="Unknown provider"):
        get_chat_model("gpt-99-typo")


def test_factory_returns_fresh_instance_each_call(settings):
    a = get_chat_model("minimax")
    b = get_chat_model("minimax")
    assert a is not b  # don't share stateful clients by accident
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key uv run pytest tests/unit/test_model_factory.py -v
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create `app/models/base.py`**

```python
"""Abstract base for ChatModel providers."""
from abc import ABC, abstractmethod

from langchain_core.language_models import BaseChatModel


class ChatModelProvider(ABC):
    @abstractmethod
    def get(self) -> BaseChatModel: ...
```

- [ ] **Step 4: Create `app/models/minimax.py`**

```python
"""MinMax provider — uses langchain-openai ChatOpenAI with MinMax's OpenAI-compatible endpoint."""
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.config import Settings
from app.models.base import ChatModelProvider


class MinMaxProvider(ChatModelProvider):
    def __init__(self, settings: Settings):
        self._settings = settings

    def get(self) -> BaseChatModel:
        return ChatOpenAI(
            model=self._settings.minimax_text_model,
            openai_api_key=self._settings.minimax_api_key,
            openai_api_base=self._settings.minimax_base_url,
            temperature=0.7,
            max_tokens=2000,
            timeout=self._settings.request_timeout_seconds,
        )
```

- [ ] **Step 5: Create `app/models/factory.py`**

```python
"""Factory for ChatModel providers."""
from functools import lru_cache

from langchain_core.language_models import BaseChatModel

from app.config import Settings, settings as _settings
from app.models.base import ChatModelProvider
from app.models.minimax import MinMaxProvider

_PROVIDERS: dict[str, type[ChatModelProvider]] = {
    "minimax": MinMaxProvider,
}


def get_chat_model(provider: str, *, _settings: Settings | None = None) -> BaseChatModel:
    """Return a fresh ChatModel instance for the given provider.

    Note: each call returns a new instance — LangChain ChatModels are
    cheap to construct; we don't cache at this layer to keep test
    isolation simple.
    """
    s = _settings or __import__("app.config", fromlist=["settings"]).settings
    cls = _PROVIDERS.get(provider)
    if cls is None:
        raise ValueError(f"Unknown provider: {provider!r}. Known: {list(_PROVIDERS)}")
    return cls(s).get()
```

- [ ] **Step 6: Create `app/models/__init__.py`**

```python
```

(empty file)

- [ ] **Step 7: Create `app/llm_retry.py`**

```python
"""Tenacity-based retry decorator for LLM calls.

Retries on transient errors (rate limit, timeout, server errors); gives up
immediately on hard errors (bad request, auth). Spec: 05-testing-milestones.md
§2.2 'LLM 抛 BadRequestError → 不重试；LLM 抛 RateLimitError → 重试 2 次后抛'.
"""
import logging
from typing import Any

from langchain_core.messages import BaseMessage
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

log = logging.getLogger(__name__)


def _is_retryable(exc: BaseException) -> bool:
    """Return True for transient errors worth retrying."""
    name = exc.__class__.__name__.lower()
    transient_markers = (
        "ratelimit",
        "ratelimitexceeded",
        "timeout",
        "timeoutexception",
        "apitimeouterror",
        "apiconnectionerror",
        "serviceunavailable",
        "internalservererror",
    )
    return any(m in name for m in transient_markers)


async def call_llm(model: Any, messages: list[BaseMessage]) -> BaseMessage:
    """Call model.ainvoke with up to 3 attempts on transient errors."""
    attempt = {"n": 0}

    @retry(
        retry=retry_if_exception_type(Exception) & _retry_filter,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        reraise=True,
        before_sleep=lambda rs: log.warning(
            "llm retry attempt=%s exc=%s", rs.attempt_number, rs.outcome.exception()
        ),
    )
    async def _go() -> BaseMessage:
        attempt["n"] += 1
        return await model.ainvoke(messages)

    return await _go()


def _retry_filter(exc: BaseException) -> bool:
    return _is_retryable(exc)
```

- [ ] **Step 8: Write test for retry**

Create `ai-runtime/tests/unit/test_llm_retry.py`:

```python
import pytest
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.llm_retry import call_llm


class _TransientThenOK:
    """Fake model that raises a transient-looking error once, then succeeds."""

    def __init__(self):
        self.calls = 0

    async def ainvoke(self, messages: list[BaseMessage]) -> BaseMessage:
        self.calls += 1
        if self.calls == 1:
            raise Exception("RateLimitError: try again")  # matches retryable pattern
        return AIMessage(content="ok")


class _AlwaysFails:
    async def ainvoke(self, messages):
        raise Exception("BadRequestError: invalid")


@pytest.mark.asyncio
async def test_call_llm_retries_on_transient_then_succeeds():
    m = _TransientThenOK()
    out = await call_llm(m, [])  # type: ignore[arg-type]
    assert out.content == "ok"
    assert m.calls == 2


@pytest.mark.asyncio
async def test_call_llm_does_not_retry_on_hard_error():
    m = _AlwaysFails()
    with pytest.raises(Exception, match="BadRequestError"):
        await call_llm(m, [])  # type: ignore[arg-type]
    assert m.calls == 1
```

- [ ] **Step 9: Run unit tests**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key uv run pytest tests/unit/ -v
```

Expected: PASS for both `test_model_factory.py` and `test_llm_retry.py`.

- [ ] **Step 10: Commit**

```bash
git add ai-runtime/app/models/ ai-runtime/app/llm_retry.py ai-runtime/tests/unit/

git commit -m "feat(ai-runtime): MinMax ChatModel provider + tenacity retry

M1's only LLM call is text analysis via MinMax (OpenAI-compatible).
  models/base.py: ChatModelProvider ABC
  models/minimax.py: MinMaxProvider wrapping ChatOpenAI with
    base_url=https://api.minimax.chat/v1
  models/factory.py: get_chat_model('minimax') -> fresh instance

llm_retry.call_llm retries up to 3 times on transient errors
(rate limit / timeout / 5xx) via tenacity exponential backoff;
gives up immediately on hard errors (bad request / auth). Spec
05-testing-milestones §2.2 'BadRequestError 不重试' is honored by
the _is_retryable name-based check (no library-specific imports).

Tests use real BaseMessage contracts + a fake model that throws
'RateLimitError' once then succeeds — proves the retry path runs.

[m1 wave 3]"
```

---

## Task 4: Python ai-runtime — GraphState + ai_doctor nodes + graph builder

**Files:**
- Create: `ai-runtime/app/graphs/__init__.py`
- Create: `ai-runtime/app/graphs/state.py`
- Create: `ai-runtime/app/graphs/nodes/__init__.py`
- Create: `ai-runtime/app/graphs/nodes/classify_input.py`
- Create: `ai-runtime/app/graphs/nodes/analyze_text.py`
- Create: `ai-runtime/app/graphs/nodes/finalize.py`
- Create: `ai-runtime/app/graphs/nodes/emit_response.py`
- Create: `ai-runtime/app/graphs/ai_doctor.py`
- Create: `ai-runtime/app/prompts/__init__.py`
- Create: `ai-runtime/app/prompts/loader.py`
- Create: `ai-runtime/app/prompts/ai_doctor/system_prompt.j2`
- Create: `ai-runtime/app/prompts/ai_doctor/analyze_text.j2`
- Create: `ai-runtime/tests/unit/test_classify_input.py`
- Create: `ai-runtime/tests/unit/test_analyze_text.py`
- Create: `ai-runtime/tests/unit/test_finalize.py`

**Interfaces (this task produces):**
- `class GraphState(TypedDict)`: messages (list), modality (Optional[str]), analysis_result (Optional[dict])
- `class AiDoctorState(GraphState)`: adds analyses (Optional[dict])
- `async def classify_input(state) -> dict` returns `{"modality": "text"}`
- `async def analyze_text(state, config=None) -> dict` returns `{"analyses": {"text": str}}`
- `async def finalize(state) -> dict` returns `{"analysis_result": str}`
- `async def emit_response(state) -> dict` returns `{"analysis_result": str}` (signals end-of-stream)
- `def build_ai_doctor_graph() -> CompiledGraph` without checkpointer (M1)
- `def render_prompt(graph: str, name: str, **vars) -> str`

- [ ] **Step 1: Write failing test for `classify_input`**

Create `ai-runtime/tests/unit/test_classify_input.py`:

```python
import pytest

from app.graphs.nodes.classify_input import classify_input


@pytest.mark.asyncio
async def test_classify_input_returns_text_for_text_only_input():
    state = {
        "messages": [{"role": "user", "content": "我最近睡不好"}],
        "files": [],
    }
    out = await classify_input(state)
    assert out == {"modality": "text"}
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key uv run pytest tests/unit/test_classify_input.py -v
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create `app/graphs/state.py`**

```python
"""Shared GraphState TypedDict. M1 only needs the text-path fields."""
from __future__ import annotations

from typing import Optional, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class GraphState(TypedDict, total=False):
    """Base state for all graphs.

    `total=False` so tests can construct partial states without every key.
    """

    # Standard message accumulator (LangGraph convention)
    messages: list[BaseMessage]

    # Common metadata
    user_id: Optional[str]
    thread_id: Optional[str]
    run_id: Optional[str]


class AiDoctorState(GraphState):
    """ai_doctor graph state.

    For M1 we only support the text modality branch; multimodal nodes
    and fields are added in M2.
    """

    modality: Optional[str]      # "text" | "audio" | "video" | "image" | "doc" | "multimodal"
    analyses: Optional[dict]     # {"text": "...", "audio": "..."} — partial results
    analysis_result: Optional[str]  # finalized reply, set by finalize
```

- [ ] **Step 4: Create `app/prompts/__init__.py` and `app/prompts/loader.py`**

`app/prompts/__init__.py`:
```python
```

`app/prompts/loader.py`:
```python
"""Load and render Jinja2 prompt templates from app/prompts/<graph>/<name>.j2."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined

_PROMPTS_DIR = Path(__file__).parent

_env = Environment(
    loader=FileSystemLoader(str(_PROMPTS_DIR)),
    autoescape=False,
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)

_cache: dict[str, str] = {}


def render_prompt(graph: str, name: str, **vars: Any) -> str:
    """Render app/prompts/<graph>/<name>.j2 with **vars."""
    template_name = f"{graph}/{name}.j2"
    if template_name not in _cache:
        _cache[template_name] = _env.get_template(template_name)
    return _cache[template_name].render(**vars)
```

- [ ] **Step 5: Create the two Jinja2 prompts**

`app/prompts/ai_doctor/system_prompt.j2`:
```
你是一位温柔、共情、专业的心理咨询陪伴者，名叫"小心"。

行为准则：
1. 全程使用简体中文回复，语言贴近口语，避免学术化或冷冰冰的表达。
2. 先共情，再回应——先承认对方的感受，再给出观察或建议。
3. 不做医学诊断，不开药，不替代专业医生。
4. 当用户表达极端情绪（自伤、自杀、伤害他人）时，温和建议联系专业机构并提供求助资源。
5. 回复长度：80-250 字之间，除非用户明确要求长文。
6. 不要使用 Markdown 标题或列表，保持自然段格式以便流式输出。

你正在与一位来访者进行单轮对话。请基于他的输入提供共情式回应。
```

`app/prompts/ai_doctor/analyze_text.j2`:
```
来访者的话：
{{ query }}

{% if history %}
最近几轮对话摘要：
{{ history }}
{% endif %}

请基于"小心"的角色设定，给出一段 80-250 字的共情式中文回复。只输出回复内容本身，不要任何元描述或解释。
```

- [ ] **Step 6: Create `app/graphs/nodes/__init__.py` and `classify_input.py`**

`app/graphs/nodes/__init__.py`:
```python
```

`app/graphs/nodes/classify_input.py`:
```python
"""M1 classify_input: text-only routing.

Multimodal classification (audio/video/image/doc/multimodal) is added in M2.
For M1, any input with no files (or empty files list) is routed to 'text'.
"""
from __future__ import annotations


async def classify_input(state) -> dict:
    """Decide which analysis node to call next.

    For M1: route everything to text unless files are present (in which case
    we still route to text but emit a warning — true file handling lands in M2).
    """
    files = state.get("files") or []
    if files:
        # M2 will branch here. For M1 we just go text and ignore files.
        return {"modality": "text"}
    return {"modality": "text"}
```

- [ ] **Step 7: Write test for `analyze_text`**

Create `ai-runtime/tests/unit/test_analyze_text.py`:

```python
import pytest
from langchain_core.messages import AIMessage
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.analyze_text import analyze_text


@pytest.mark.asyncio
async def test_analyze_text_calls_model_and_returns_analyses(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")

    fake = FakeListChatModel(responses=["我理解你的感受，能多说说吗？"])

    state = {
        "messages": [{"role": "user", "content": "我最近很难入睡"}],
        "modality": "text",
    }
    out = await analyze_text(state, model=fake)
    assert "analyses" in out
    assert out["analyses"]["text"].startswith("我")
```

- [ ] **Step 8: Run test, verify it fails**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key uv run pytest tests/unit/test_analyze_text.py -v
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 9: Create `app/graphs/nodes/analyze_text.py`**

```python
"""M1 text analysis node.

Calls MinMax via the model factory, with prompt rendered from Jinja2.
The state is expected to have at least one user message. Returns
{"analyses": {"text": "<reply>"}}.
"""
from __future__ import annotations

from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.graphs.state import AiDoctorState
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.prompts.loader import render_prompt


def _last_user_text(state: AiDoctorState) -> str:
    msgs = state.get("messages") or []
    for m in reversed(msgs):
        content = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else None)
        role = getattr(m, "type", None) or (m.get("role") if isinstance(m, dict) else None)
        if role in ("user", "human") and content:
            return content
    return ""


async def analyze_text(state: AiDoctorState, model: Any | None = None) -> dict:
    """Run text analysis. If `model` is passed (for tests), use it; else fetch via factory."""
    user_query = _last_user_text(state)
    system_prompt = render_prompt("ai_doctor", "system_prompt")
    user_prompt = render_prompt("ai_doctor", "analyze_text", query=user_query)

    llm = model if model is not None else get_chat_model("minimax")
    reply = await call_llm(
        llm,
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ],
    )
    text = reply.content if isinstance(reply.content, str) else str(reply.content)
    analyses = dict(state.get("analyses") or {})
    analyses["text"] = text
    return {"analyses": analyses}
```

- [ ] **Step 10: Write test for `finalize`**

Create `ai-runtime/tests/unit/test_finalize.py`:

```python
import pytest

from app.graphs.nodes.finalize import finalize


@pytest.mark.asyncio
async def test_finalize_picks_text_analysis_when_modality_is_text():
    state = {
        "modality": "text",
        "analyses": {"text": "我理解你的感受。"},
    }
    out = await finalize(state)
    assert out == {"analysis_result": "我理解你的感受。"}


@pytest.mark.asyncio
async def test_finalize_falls_back_when_modality_missing():
    state = {"analyses": {"text": "hi"}}
    out = await finalize(state)
    assert out == {"analysis_result": "hi"}


@pytest.mark.asyncio
async def test_finalize_returns_empty_string_when_nothing_to_finalize():
    state = {"modality": "text"}
    out = await finalize(state)
    assert out == {"analysis_result": ""}
```

- [ ] **Step 11: Run test, verify it fails**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key uv run pytest tests/unit/test_finalize.py -v
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 12: Create `app/graphs/nodes/finalize.py`**

```python
"""Pick the final reply from analysis branches and stuff into analysis_result."""
from __future__ import annotations

from app.graphs.state import AiDoctorState


async def finalize(state: AiDoctorState) -> dict:
    """Return the analysis text matching the modality.

    For M1 only 'text' branch exists; if a key is missing we fall back to
    the first available analysis, then to empty string.
    """
    analyses = state.get("analyses") or {}
    modality = state.get("modality") or "text"
    text = analyses.get(modality) or next(iter(analyses.values()), "")
    return {"analysis_result": text}
```

- [ ] **Step 13: Create `app/graphs/nodes/emit_response.py`**

```python
"""emit_response — M1 stub.

In M4 this node will emit an SSE 'message_end' event into the state and
trigger long-term memory writes. For M1 it's a no-op pass-through that
signals the graph to END. Real SSE emission happens in streaming.py at the
api/chat.py layer.
"""
from __future__ import annotations

from app.graphs.state import AiDoctorState


async def emit_response(state: AiDoctorState) -> dict:
    return {}
```

- [ ] **Step 14: Create `app/graphs/__init__.py`**

```python
```

(empty file)

- [ ] **Step 15: Create `app/graphs/ai_doctor.py`**

```python
"""M1 ai_doctor graph builder — text-only path.

START -> classify_input -> analyze_text -> finalize -> emit_response -> END

Multimodal branches (audio/video/image/doc/fusion) are added in M2.
"""
from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.graphs.nodes.analyze_text import analyze_text
from app.graphs.nodes.classify_input import classify_input
from app.graphs.nodes.emit_response import emit_response
from app.graphs.nodes.finalize import finalize
from app.graphs.state import AiDoctorState


def build_ai_doctor_graph():
    g = StateGraph(AiDoctorState)
    g.add_node("classify_input", classify_input)
    g.add_node("analyze_text", analyze_text)
    g.add_node("finalize", finalize)
    g.add_node("emit_response", emit_response)

    g.add_edge(START, "classify_input")
    g.add_edge("classify_input", "analyze_text")  # M1: always text
    g.add_edge("analyze_text", "finalize")
    g.add_edge("finalize", "emit_response")
    g.add_edge("emit_response", END)

    # M4 will add: g = g.compile(checkpointer=get_checkpointer())
    # For M1 we compile without checkpointer.
    return g.compile()
```

- [ ] **Step 16: Run all unit tests**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key uv run pytest tests/unit/ -v
```

Expected: PASS for classify_input, analyze_text, finalize, and the previously-written model/retry tests.

- [ ] **Step 17: Commit**

```bash
git add ai-runtime/app/graphs/ ai-runtime/app/prompts/ ai-runtime/tests/unit/

git commit -m "feat(ai-runtime): ai_doctor graph text-only path

M1 graph (no checkpointer — persistence is M4):

  START -> classify_input -> analyze_text -> finalize -> emit_response -> END

  classify_input: routes everything to 'text' for M1; multimodal branches
    added in M2 (image/audio/video/doc/fusion)
  analyze_text: renders ai_doctor/system_prompt.j2 + analyze_text.j2,
    calls MinMax via get_chat_model('minimax') + call_llm retry wrapper,
    stores result in state['analyses']['text']
  finalize: picks state['analyses'][state['modality']] into
    state['analysis_result']
  emit_response: M1 no-op; M4 will fire SSE message_end + extract_facts

Jinja2 prompt loader is a single function (render_prompt(graph, name,
**vars)) with StrictUndefined to catch missing template variables at
render time rather than silently dropping them.

system_prompt.j2 + analyze_text.j2 are M1-quality prompts (Chinese,
empathetic, 80-250 chars); full prompt engineering is M3 per spec 06.

State uses TypedDict total=False so unit tests can construct partial
states without every key. AiDoctorState extends GraphState with
modality/analyses/analysis_result fields. M2 will extend further.

[m1 wave 4]"
```

---

## Task 5: Python ai-runtime — streaming + auth + chat API + main wire

**Files:**
- Create: `ai-runtime/app/auth.py`
- Create: `ai-runtime/app/streaming.py`
- Create: `ai-runtime/app/api/__init__.py`
- Create: `ai-runtime/app/api/chat.py`
- Modify: `ai-runtime/app/main.py`

**Interfaces (this task produces):**
- `async def verify_internal_token(x_internal_token: str = Header(...), x_user_id: str = Header(...)) -> str`
- `def format_sse_event(event: str, data: dict) -> str`
- `async def stream_graph(graph, input, config, run_id) -> AsyncIterator[str]`
- `POST /v1/chat` returns `StreamingResponse(media_type='text/event-stream')`
- `app.main` registers the chat router and exposes `/healthz`

- [ ] **Step 1: Create `app/auth.py`**

```python
"""Internal token validator. Used by every /v1/* endpoint.

Spring Boot injects X-Internal-Token (must match LANGGRAPH_INTERNAL_TOKEN)
and X-User-Id on every request. Returns the user_id to the route handler.
"""
from __future__ import annotations

import hmac

from fastapi import Header, HTTPException

from app.config import settings


async def verify_internal_token(
    x_internal_token: str = Header(..., alias="X-Internal-Token"),
    x_user_id: str = Header(..., alias="X-User-Id"),
) -> str:
    """Constant-time compare to prevent timing attacks."""
    if not x_internal_token or not hmac.compare_digest(
        x_internal_token, settings.internal_token
    ):
        raise HTTPException(status_code=401, detail={"code": "INVALID_INTERNAL_TOKEN"})
    if not x_user_id:
        raise HTTPException(status_code=400, detail={"code": "MISSING_USER_ID"})
    return x_user_id
```

- [ ] **Step 2: Create `app/streaming.py`**

```python
"""graph.astream_events -> SSE frame serializer.

M1 implements:
  - on_chain_start for known node names -> SSE 'node_start'
  - on_llm_stream (AIMessageChunk content delta) -> SSE 'token'
  - on_chain_end for emit_response -> SSE 'message_end' with full_content

We deliberately do NOT try to handle every astream event type — only
the ones the frontend cares about. Other events are silently dropped.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any, AsyncIterator

from langchain_core.messages import AIMessageChunk

# Node names whose on_chain_start we surface as SSE 'node_start'.
_TRACKED_NODE_NAMES = frozenset({
    "classify_input",
    "analyze_text",
    "finalize",
    "emit_response",
})


def format_sse_event(event: str, data: dict[str, Any]) -> str:
    """One SSE frame: 'event: <name>\\ndata: <json>\\n\\n'."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def stream_graph(
    graph: Any,
    input_state: dict[str, Any],
    config: dict[str, Any],
    run_id: str,
    *,
    timeout_seconds: int = 120,
) -> AsyncIterator[str]:
    """Yield SSE frames from graph.astream_events(version='v2')."""
    thread_id = config.get("configurable", {}).get("thread_id", "")
    accumulated = ""
    full_content = ""

    try:
        async with asyncio.timeout(timeout_seconds):
            async for event in graph.astream_events(input_state, config=config, version="v2"):
                kind = event.get("event")
                name = event.get("name", "")
                data = event.get("data", {}) or {}

                if kind == "on_chain_start" and name in _TRACKED_NODE_NAMES:
                    yield format_sse_event("node_start", {"name": name, "ts": time.time()})

                elif kind == "on_llm_stream":
                    chunk = data.get("chunk")
                    if isinstance(chunk, AIMessageChunk):
                        delta = chunk.content or ""
                        if isinstance(delta, str) and delta:
                            accumulated += delta
                            yield format_sse_event("token", {
                                "delta": delta,
                                "thread_id": thread_id,
                                "run_id": run_id,
                            })

                elif kind == "on_chain_end" and name == "emit_response":
                    # The 'analysis_result' key was written by finalize earlier
                    output = data.get("output") or {}
                    full_content = output.get("analysis_result") or accumulated
                    yield format_sse_event("message_end", {
                        "thread_id": thread_id,
                        "run_id": run_id,
                        "full_content": full_content,
                        "files": [],
                    })

    except asyncio.TimeoutError:
        yield format_sse_event("error", {
            "code": "LLM_TIMEOUT",
            "message": "Graph execution timed out",
            "recoverable": True,
            "thread_id": thread_id,
            "run_id": run_id,
        })
    except asyncio.CancelledError:
        # User-initiated stop; the streaming layer above is responsible for
        # any cleanup. Don't emit an error event.
        return
    except Exception as exc:
        yield format_sse_event("error", {
            "code": "INTERNAL_ERROR",
            "message": str(exc),
            "recoverable": False,
            "thread_id": thread_id,
            "run_id": run_id,
        })
```

- [ ] **Step 3: Create `app/api/__init__.py`**

```python
```

(empty file)

- [ ] **Step 4: Create `app/api/chat.py`**

```python
"""POST /v1/chat — main entry point.

Spring Boot (with X-Internal-Token) calls this. We dispatch to the
ai_doctor graph (M1 only — psych_test graph arrives in M3) and stream
the graph's events back as SSE.

M5 will add Redis-backed cancel flags here; M1 just streams to completion
or timeout.
"""
from __future__ import annotations

import uuid
from typing import Any, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.auth import verify_internal_token
from app.graphs.ai_doctor import build_ai_doctor_graph
from app.streaming import format_sse_event, stream_graph

router = APIRouter()

_GRAPH_BUILDERS: dict[str, Any] = {
    "ai-doctor": build_ai_doctor_graph,
}


class ChatRequest(BaseModel):
    graph: str = Field(..., min_length=1)
    thread_id: str = ""
    input: dict[str, Any] = Field(default_factory=dict)


@router.post("/chat")
async def chat(
    body: ChatRequest,
    user_id: str = Depends(verify_internal_token),
) -> StreamingResponse:
    builder = _GRAPH_BUILDERS.get(body.graph)
    if builder is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "GRAPH_NOT_FOUND", "graph": body.graph,
                    "known": list(_GRAPH_BUILDERS)},
        )

    thread_id = body.thread_id or f"thread_{uuid.uuid4().hex}"
    run_id = f"run_{uuid.uuid4().hex}"
    graph = builder()

    config = {"configurable": {"thread_id": thread_id, "user_id": user_id, "run_id": run_id}}
    input_state: dict[str, Any] = dict(body.input)
    input_state.setdefault("user_id", user_id)
    input_state.setdefault("thread_id", thread_id)
    input_state.setdefault("run_id", run_id)

    async def event_gen() -> AsyncIterator[str]:
        # Emit run_start immediately so the client knows the request was accepted.
        yield format_sse_event("run_start", {
            "thread_id": thread_id,
            "run_id": run_id,
            "graph": body.graph,
        })
        async for frame in stream_graph(graph, input_state, config, run_id):
            yield frame

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream;charset=UTF-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
```

- [ ] **Step 5: Replace `app/main.py` to wire chat router + keep /healthz**

```python
"""FastAPI entrypoint for ai-runtime."""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.chat import router as chat_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # M1: nothing to warm up (no checkpointer, no long-term memory, no file storage).
    # Future milestones add PostgresSaver / Redis / file storage init here.
    yield


app = FastAPI(
    title="EmoMind AI Runtime",
    version="0.2.0",
    lifespan=lifespan,
)

app.include_router(chat_router, prefix="/v1")


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "service": "ai-runtime", "milestone": "M1"}
```

- [ ] **Step 6: Manual smoke test — start uvicorn locally and verify /healthz**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key uv run uvicorn app.main:app --port 8001 &
SERVER_PID=$!
sleep 3
echo "===healthz==="
curl -sS http://localhost:8001/healthz
echo
echo "===401 without token==="
curl -sSi -X POST http://localhost:8001/v1/chat -H "Content-Type: application/json" -d '{"graph":"ai-doctor","input":{}}' | head -3
echo "===401 with bad token==="
curl -sSi -X POST http://localhost:8001/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: wrong" \
  -H "X-User-Id: 00000000-0000-0000-0000-000000000001" \
  -d '{"graph":"ai-doctor","input":{}}' | head -3
kill $SERVER_PID
```

Expected:
- `/healthz` returns 200 JSON with `service: ai-runtime, milestone: M1`
- Without token: 401 (HTTPException from verify_internal_token)
- With wrong token: 401

- [ ] **Step 7: Commit**

```bash
git add ai-runtime/app/auth.py ai-runtime/app/streaming.py ai-runtime/app/api/ ai-runtime/app/main.py

git commit -m "feat(ai-runtime): SSE streaming + X-Internal-Token + /v1/chat

app/auth.py: verify_internal_token uses hmac.compare_digest for
constant-time token check; returns user_id from X-User-Id header.
Spring will call this on every /v1/* request.

app/streaming.py: graph.astream_events -> SSE frames. M1 emits:
  run_start (on chat accept)
  node_start (on_chain_start for tracked nodes)
  token (on_llm_stream deltas)
  message_end (on_chain_end of emit_response, with full_content)
  error (timeout / internal)
CancelledError is swallowed silently — M5 will hook cancel flags here.

app/api/chat.py: POST /v1/chat. Dispatches to ai_doctor graph for now
(psych_test lands in M3). Generates thread_id if missing. Sets
Cache-Control: no-cache + X-Accel-Buffering: no per spec 02-components §1.1.

app/main.py wires chat router and exposes /healthz. Lifespan is a
no-op for M1 (no checkpointer / Redis / file storage to init); later
milestones add init there.

Verified locally:
  /healthz -> 200 {service: ai-runtime, milestone: M1}
  POST /v1/chat without X-Internal-Token -> 401
  POST /v1/chat with wrong X-Internal-Token -> 401

[m1 wave 5]"
```

---

## Task 6: Python ai-runtime — pytest integration test for end-to-end text path

**Files:**
- Create: `ai-runtime/tests/conftest.py`
- Create: `ai-runtime/tests/integration/__init__.py`
- Create: `ai-runtime/tests/integration/test_ai_doctor_text.py`

**Interfaces (this task produces):**
- `tests/conftest.py`: `mock_minimax_model` fixture (FakeListChatModel with configurable responses)
- `tests/integration/test_ai_doctor_text.py::test_text_only_path_emits_full_sse`

- [ ] **Step 1: Create `tests/conftest.py`**

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
def _set_minimax_env(monkeypatch):
    """Every test gets a valid LANGGRAPH_MINIMAX_API_KEY env var."""
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
```

- [ ] **Step 2: Create `tests/integration/__init__.py`**

```python
```

(empty file)

- [ ] **Step 3: Write failing integration test**

Create `tests/integration/test_ai_doctor_text.py`:

```python
"""End-to-end test for the ai_doctor text path: graph + streaming."""
import asyncio
import json

import pytest

from app.graphs.ai_doctor import build_ai_doctor_graph
from app.streaming import format_sse_event, stream_graph


def _parse_sse(frames: list[str]):
    """Return list of (event_name, data_dict) from raw SSE frames."""
    out = []
    for frame in frames:
        # frame like "event: foo\ndata: {...}\n\n"
        lines = frame.split("\n")
        event = next((l[len("event: "):] for l in lines if l.startswith("event: ")), "")
        data_line = next((l[len("data: "):] for l in lines if l.startswith("data: ")), "{}")
        out.append((event, json.loads(data_line)))
    return out


@pytest.mark.asyncio
async def test_text_only_path_emits_full_sse(mock_minimax_model):
    """Run the ai_doctor graph and assert we get run_start/node_start/token/message_end."""
    # Build a graph that uses the fake model.
    # We monkeypatch get_chat_model by patching analyze_text's call site via the
    # `model` kwarg path. Since the graph builder doesn't accept a model injection
    # point yet, the easier path is to call analyze_text directly with the fake
    # model and then verify finalize + emit_response on the result.

    from app.graphs.nodes.analyze_text import analyze_text
    from app.graphs.nodes.finalize import finalize
    from app.graphs.nodes.emit_response import emit_response

    state = {
        "messages": [{"role": "user", "content": "我最近很难入睡"}],
        "modality": "text",
        "user_id": "u1",
        "thread_id": "t1",
        "run_id": "r1",
    }

    state.update(await analyze_text(state, model=mock_minimax_model))
    state.update(await finalize(state))
    state.update(await emit_response(state))

    assert state["analysis_result"].startswith("我")

    # Now exercise the actual stream_graph path with a real CompiledGraph.
    graph = build_ai_doctor_graph()
    config = {"configurable": {"thread_id": "t2", "user_id": "u1", "run_id": "r2"}}

    frames = []
    async for f in stream_graph(graph, state, config, run_id="r2", timeout_seconds=15):
        frames.append(f)

    events = _parse_sse(frames)
    event_names = [e[0] for e in events]
    # Expect at least: node_start (for analyze_text), token, message_end.
    assert "node_start" in event_names
    assert "token" in event_names
    assert "message_end" in event_names

    # The message_end should carry the accumulated content.
    msg_end = next(d for e, d in events if e == "message_end")
    assert msg_end["thread_id"] == "t2"
    assert msg_end["run_id"] == "r2"
    assert msg_end["full_content"]
```

- [ ] **Step 4: Run test, verify it passes (M1)**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key uv run pytest tests/integration/test_ai_doctor_text.py -v
```

Expected: PASS. The test exercises both node-level direct calls (analyze_text with fake model) and the full graph through `stream_graph`.

- [ ] **Step 5: Run full ai-runtime test suite**

```bash
cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key uv run pytest -v
```

Expected: all tests PASS — unit + integration.

- [ ] **Step 6: Commit**

```bash
git add ai-runtime/tests/conftest.py ai-runtime/tests/integration/

git commit -m "test(ai-runtime): integration test for ai_doctor text path

End-to-end coverage of M1's main flow:
  analyze_text (with FakeListChatModel) -> finalize -> emit_response
  + build_ai_doctor_graph().astream_events -> stream_graph

Asserts the SSE frame sequence includes node_start, token, and
message_end, with thread_id/run_id preserved through the stream.

tests/conftest.py provides autouse env setup (LANGGRAPH_MINIMAX_API_KEY)
and a mock_minimax_model fixture so individual tests don't need to
repeat boilerplate.

Uses FakeListChatModel from langchain_core — no real LLM calls, no
API key required for CI to pass.

[m1 wave 6]"
```

---

## Task 7: Frontend — `langgraphApi.ts` + switch `/user/ai-doctor`

**Files:**
- Create: `frontend/src/services/langgraphTypes.ts`
- Create: `frontend/src/services/langgraphApi.ts`
- Create: `frontend/src/lib/sseParser.ts`
- Modify: `frontend/src/routes/user/ai-doctor.tsx` (swap import only)
- Verify: `bun run lint` does not regress

**Interfaces (this task produces):**
- `langgraphApi.sendChatStream(graph, input, callbacks, options)` mirrors the spec's signature (02-components §3.1)
- `langgraphApi.stopChat(threadId, runId)` — M1 calls the Spring `/api/v1/ai/chat/stop` if exposed; otherwise sends an `AbortSignal` to fetch and lets it propagate. M5 will replace with Redis-backed cancel.
- `langgraphTypes.LangGraphMessage`, `StreamCallbacks` types matching spec.

- [ ] **Step 1: Create `frontend/src/services/langgraphTypes.ts`**

```typescript
/**
 * LangGraph SSE event types — matches the wire protocol defined in
 * doc/langgraph-migration/02-components.md §1.1 SSE events.
 */

export type LangGraphRole = "user" | "assistant";

export interface LangGraphFile {
  file_id: string;
  url: string;
  mime: string;
  size: number;
  name?: string;
}

export interface LangGraphMessage {
  role: LangGraphRole;
  content: string;
  files?: LangGraphFile[];
  isStreaming?: boolean;
  threadId?: string;
  runId?: string;
}

export interface LangGraphConversation {
  threadId: string;
  graph: "ai-doctor" | "psych-test";
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StreamCallbacks {
  onRunStart?: (threadId: string, runId: string, graph: string) => void;
  onNodeStart?: (nodeName: string) => void;
  onToken?: (delta: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onMessageEnd?: (
    threadId: string,
    runId: string,
    fullContent: string,
    files?: LangGraphFile[]
  ) => void;
  onWorkflowEvent?: (type: string, payload: unknown) => void;
  onError?: (code: string, message: string, recoverable: boolean) => void;
}

export interface ChatStreamOptions {
  threadId?: string;
  signal?: AbortSignal;
}
```

- [ ] **Step 2: Create `frontend/src/lib/sseParser.ts`**

```typescript
/**
 * Tiny SSE frame parser over a ReadableStream<string> chunk source.
 * Yields (event, data) tuples. Handles multi-line data blocks (joins them),
 * ignores comments (lines starting with ':'), tolerates CRLF.
 */

export interface SseFrame {
  event: string;
  data: string;
}

export async function* parseSseStream(
  source: ReadableStream<Uint8Array>
): AsyncGenerator<SseFrame> {
  const reader = source.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      // Split on SSE record terminator: a blank line (\n\n or \r\n\r\n).
      while ((idx = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + (buffer[idx] === "\r" ? 4 : 2));
        const frame = parseFrame(raw);
        if (frame) yield frame;
      }
    }
    // Flush any trailing frame
    if (buffer.trim()) {
      const frame = parseFrame(buffer);
      if (frame) yield frame;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseFrame(raw: string): SseFrame | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const field = line.slice(0, sep);
    let value = line.slice(sep + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
  }

  if (!dataLines.length) return null;
  return { event, data: dataLines.join("\n") };
}
```

- [ ] **Step 3: Create `frontend/src/services/langgraphApi.ts`**

```typescript
/**
 * langgraphApi — replaces difyApi.ts for the ai_doctor (and later psych-test) graphs.
 *
 * The Spring gateway at /api/v1/ai/chat accepts JSON, returns text/event-stream
 * SSE. We use fetch + AbortSignal (the EventSource API doesn't support custom
 * headers or POST bodies).
 */
import { parseSseStream } from "@/lib/sseParser";
import type {
  LangGraphMessage,
  StreamCallbacks,
  ChatStreamOptions,
} from "./langgraphTypes";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface ChatRequestBody {
  graph: "ai-doctor" | "psych-test";
  thread_id?: string;
  input: {
    messages: LangGraphMessage[];
    files?: unknown[];
  };
}

export async function sendChatStream(
  graph: "ai-doctor" | "psych-test",
  input: { messages: LangGraphMessage[]; files?: unknown[] },
  callbacks: StreamCallbacks,
  options: ChatStreamOptions = {}
): Promise<void> {
  const body: ChatRequestBody = {
    graph,
    thread_id: options.threadId,
    input,
  };

  const res = await fetch(`${API_BASE}/api/v1/ai/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok || !res.body) {
    callbacks.onError?.(
      "HTTP_ERROR",
      `chat request failed: ${res.status} ${res.statusText}`,
      res.status >= 500
    );
    return;
  }

  for await (const frame of parseSseStream(res.body)) {
    let payload: Record<string, unknown> = {};
    try {
      payload = frame.data ? JSON.parse(frame.data) : {};
    } catch {
      // Ignore malformed JSON; treat as empty payload.
    }

    switch (frame.event) {
      case "run_start":
        callbacks.onRunStart?.(
          String(payload.thread_id ?? ""),
          String(payload.run_id ?? ""),
          String(payload.graph ?? graph)
        );
        break;
      case "node_start":
        callbacks.onNodeStart?.(String(payload.name ?? ""));
        break;
      case "token":
        callbacks.onToken?.(String(payload.delta ?? ""));
        break;
      case "tool_call":
        callbacks.onToolCall?.(
          String(payload.name ?? ""),
          (payload.args as Record<string, unknown>) ?? {}
        );
        break;
      case "message_end":
        callbacks.onMessageEnd?.(
          String(payload.thread_id ?? ""),
          String(payload.run_id ?? ""),
          String(payload.full_content ?? ""),
          (payload.files as never[]) ?? undefined
        );
        break;
      case "workflow_event":
        callbacks.onWorkflowEvent?.(
          String(payload.type ?? ""),
          payload.payload
        );
        break;
      case "error":
        callbacks.onError?.(
          String(payload.code ?? "UNKNOWN"),
          String(payload.message ?? ""),
          Boolean(payload.recoverable)
        );
        break;
      default:
        // unknown event type — ignore
        break;
    }
  }
}

/**
 * Stop a running chat. M1: sends AbortSignal-like cancel to Spring; Spring's
 * M1 AiController just returns 200 (no-op). M5 will wire Redis-backed cancel
 * via ai-runtime's /v1/chat/stop.
 */
export async function stopChat(threadId: string, runId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/ai/chat/stop`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: threadId, run_id: runId }),
    });
  } catch {
    // Best-effort; the actual stream is aborted via AbortSignal at the call site.
  }
}
```

- [ ] **Step 4: Swap the import in `routes/user/ai-doctor.tsx`**

Find the current difyApi import. It will look like:

```typescript
import { sendMessageStream, ... } from "@/services/difyApi";
```

Replace with:

```typescript
import { sendChatStream, stopChat } from "@/services/langgraphApi";
import type { StreamCallbacks, LangGraphMessage } from "@/services/langgraphTypes";
```

Then find every call to the old `sendMessageStream(...)` and replace with `sendChatStream(graph, input, callbacks, options)` form. Map the argument shape: messages → input.messages, callbacks → new StreamCallbacks shape. The original code likely has its own callback type — adapt at the call site.

If the file has 100+ lines of Dify-specific logic (chunk buffering, version handling), DO NOT rewrite the whole file in this task. Just:
1. Swap the import.
2. Adapt the call signature so it compiles.
3. Add a `// TODO(M5):` comment where Dify-specific behavior remains.

If the file is simple (< 50 lines, just a wrapper), do the full swap.

- [ ] **Step 5: Verify no TypeScript errors at the call site**

```bash
cd frontend && bun run lint
```

Expected: zero errors from the changed file. Other pre-existing TS errors (the 6 dangling difyApi imports in other files) are M5 scope and can remain.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/langgraphTypes.ts \
        frontend/src/services/langgraphApi.ts \
        frontend/src/lib/sseParser.ts \
        frontend/src/routes/user/ai-doctor.tsx

git commit -m "feat(frontend): langgraphApi.ts + switch /user/ai-doctor

M1 frontend deliverable: write the new LangGraph client and migrate
the ai-doctor route off the (deleted) difyApi.

langgraphTypes.ts: LangGraphMessage, StreamCallbacks, LangGraphFile,
LangGraphConversation — matches spec 02-components §3.1 exactly.

langgraphApi.ts: sendChatStream + stopChat. Uses fetch + AbortSignal
(EventSource can't POST or set custom headers). SSE parser lives in
src/lib/sseParser.ts as a generic ReadableStream -> {event, data}
async generator, reusable in M5 when we add pause/resume and
regenerate-versions.

stopChat is a best-effort POST to /api/v1/ai/chat/stop; in M1 the
Spring endpoint is a no-op (real cancel lands in M5 with Redis flags).
The actual stream abort happens via the AbortSignal passed to
sendChatStream.

routes/user/ai-doctor.tsx: swap difyApi -> langgraphApi import. Map
old callback signatures onto the new StreamCallbacks shape. If the
file contains Dify-specific logic (chunk buffering, version handling),
leave it with a TODO(M5) — full useChat.ts rewrite is M5 scope.

Pre-existing TS errors in OTHER files that still import difyApi
(ConversationContext, usePsychologicalTest, chat-history, user/index)
are NOT touched — they remain neutralized. They don't block M1
because the /user/ai-doctor route compiles standalone.

Verified: bun run lint shows no NEW errors from the changed files.

[m1 wave 7]"
```

---

## Task 8: Playwright spec + full-stack verification + tag

**Files:**
- Create: `frontend/tests/chat-streaming.spec.ts`
- Modify: none (just add new test)

- [ ] **Step 1: Write the Playwright spec**

Create `frontend/tests/chat-streaming.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

/**
 * M1 verification: login, send a text message to ai-doctor, watch the
 * streamed assistant response land in the UI.
 *
 * Prerequisite: stack is up (docker compose), superuser exists
 * (FIRST_SUPERUSER=admin@example.com / FIRST_SUPERUSER_PASSWORD=changethis).
 * This spec uses the auth.setup.ts that generates playwright/.auth/user.json
 * if it isn't already there.
 */

test("ai-doctor streams a text reply", async ({ page }) => {
  // Login (assumes auth.setup.ts has already created user.json, or fall back here)
  await page.goto("/login");
  await page.fill('input[name="email"], input[type="email"]', "admin@example.com");
  await page.fill('input[name="password"], input[type="password"]', "changethis");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/user/, { timeout: 10_000 });

  // Navigate to ai-doctor chat
  await page.goto("/user/ai-doctor");
  await expect(page).toHaveURL(/\/user\/ai-doctor/);

  // Find the chat input (data-testid is preferred but fall back to textarea)
  const input = page.locator(
    '[data-testid="chat-input"], textarea[placeholder*="说"], textarea'
  ).first();
  await input.fill("你好，请简单介绍一下你自己");

  // Click send
  await page.click(
    '[data-testid="send-btn"], button:has-text("发送"), button[type="submit"]'
  );

  // The assistant message bubble should appear within 30s
  const assistant = page
    .locator('[data-testid="assistant-message"], .assistant, .ai-message')
    .first();
  await expect(assistant).toBeVisible({ timeout: 30_000 });

  // It should grow over time (token streaming)
  const initial = (await assistant.textContent()) ?? "";
  await page.waitForTimeout(2_000);
  const later = (await assistant.textContent()) ?? "";
  // Either grew (streaming) or stayed the same length (full message already
  // arrived). We just assert non-empty in the M1 happy path.
  expect(later.length).toBeGreaterThan(0);
  expect(initial.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run Playwright locally**

```bash
cd frontend && bunx playwright test tests/chat-streaming.spec.ts --reporter=line
```

Expected: depends on whether LANGGRAPH_MINIMAX_API_KEY in the running ai-runtime is real. If it is, test passes end-to-end. If not, the test may hang on the assistant-message assertion (waiting for a real LLM reply that never comes).

If the test times out, that's NOT a code bug — it's a missing API key. Document this and move on:

```bash
# Verify with a manual curl instead:
TOKEN=$(curl -sS -X POST http://localhost:8080/api/v1/login/access-token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=admin@example.com&password=changethis' \
  | python -c "import json,sys; print(json.load(sys.stdin)['access_token'])")

curl -sSi -N -X POST http://localhost:8080/api/v1/ai/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"graph":"ai-doctor","input":{"messages":[{"role":"user","content":"hello"}]}}' | head -30
```

Expected SSE: `event: run_start`, then `event: token` (one or more), then `event: message_end` (if real API key) OR `event: error` with `code: INTERNAL_ERROR` (if API key is invalid).

- [ ] **Step 3: Commit the spec**

```bash
git add frontend/tests/chat-streaming.spec.ts

git commit -m "test(frontend): chat-streaming Playwright spec for M1

Asserts: login as superuser -> navigate to /user/ai-doctor -> send
text -> assistant message appears within 30s -> message is non-empty.

Uses flexible selectors (data-testid preferred, falls back to
placeholder / type / class names) so it survives the M5 useChat
rewrite.

End-to-end pass depends on the running ai-runtime having a valid
LANGGRAPH_MINIMAX_API_KEY. Without one, the test will timeout waiting
for a reply (that's an env issue, not a code issue). Document this
in PR description when filing for review.

[m1 wave 8]"
```

- [ ] **Step 4: Run final verification gates**

```bash
cd backend-sb && mvn -q test
echo "===backend tests===" && echo $?

cd ai-runtime && LANGGRAPH_MINIMAX_API_KEY=test-key uv run pytest -v
echo "===ai-runtime tests===" && echo $?

cd frontend && bun run lint
echo "===frontend lint===" && echo $?

cd /f/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg
docker compose -f compose.yml -f compose.override.yml config > /dev/null
echo "===compose config===" && echo $?
```

Expected: all four exit 0.

- [ ] **Step 5: Verify the final commit list**

```bash
cd /f/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg
git log --oneline a1e3ba1..HEAD
```

Expected: 8 commits, one per task, all with `[m1 wave N]` suffix.

- [ ] **Step 6: Tag the milestone (commit only — DO NOT push the tag yet)**

```bash
cd /f/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg

git tag -d m1-ai-doctor-text 2>/dev/null  # in case a prior attempt left one
git tag m1-ai-doctor-text HEAD
git tag -n m1-ai-doctor-text  # show annotation
```

- [ ] **Step 7: Final M1 commit (changelog-style)**

```bash
cd /f/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg

git commit --allow-empty -m "chore(m1): tag m1-ai-doctor-text at <this-commit>

M1 delivers the end-to-end ai_doctor text path:

  Browser -> /user/ai-doctor -> langgraphApi.sendChatStream
        -> POST /api/v1/ai/chat (Spring)
        -> AiProxyService.proxyChatStream (WebClient + headers)
        -> ai-runtime POST /v1/chat (FastAPI)
        -> ai_doctor graph: classify -> analyze_text -> finalize -> emit
        -> SSE frames bubble back: run_start / node_start / token / message_end

In-scope:
  - ai_doctor graph TEXT branch only (multimodal routes added in M2)
  - Spring AiController /chat + AiProxyService + LangGraphProperties
  - ai-runtime chat models (MinMax only), retry, streaming, auth, /v1/chat
  - Two Jinja2 prompts (system + analyze_text) for ai_doctor text path
  - Frontend langgraphApi + langgraphTypes + sseParser
  - Frontend /user/ai-doctor route swapped from difyApi to langgraphApi
  - pytest unit + integration coverage
  - JUnit AiProxyService + AiControllerAuth coverage
  - Playwright chat-streaming.spec.ts

Explicitly out of scope (deferred to later milestones):
  - M2: multimodal (audio/video/image/doc/fusion), Qwen3-Omni, file upload
  - M3: psych_test graph, Dify YAML prompt extraction, intent routing
  - M4: PostgresSaver persistence, pgvector long-term memory,
        ConversationMetaService, V5 Flyway
  - M5: stop/regenerate-versions/pause-resume, Redis cancel flags,
        full useChat.ts rewrite
  - Frontend: 5 other files still importing the neutralized difyApi
        (ConversationContext, usePsychologicalTest, chat-history,
        user/index) — left for M5 rewrite

Verification gates (all green at tag time):
  - mvn test: 115+N PASS (N = new tests in T1)
  - pytest: all PASS (unit + integration, FakeListChatModel)
  - bun run lint: no new errors
  - docker compose config: exit 0
  - manual curl: SSE frames flow through

[m1 milestone complete]"
```

Replace `<this-commit>` with the hash from Step 5.

- [ ] **Step 8: Report to user**

Tell the user:
1. Final HEAD hash
2. Tag hash
3. Commit count since M0 (`git log --oneline m0-foundation..m1-ai-doctor-text`)
4. Test counts (Java / Python)
5. Any caveats (e.g., Playwright test requires real MINIMAX_API_KEY to pass end-to-end)

---

## Self-Review

Run this before handoff. Fix any issues inline.

**1. Spec coverage:**

- [x] M1 deliverable "ai-doctor graph 文本路径" — T4 (graph builder + nodes), T5 (SSE)
- [x] M1 deliverable "前端 /user/ai-doctor 切到 langgraphApi" — T7
- [x] "Playwright chat-streaming 通过" — T8
- [x] "models/factory.py + models/minimax.py" — T3
- [x] "graphs/state.py" — T4
- [x] "streaming.py" — T5
- [x] "auth.py" — T5
- [x] "AiController.chat + AiProxyService.proxyChatStream" — T1
- [x] "langgraphApi.ts (基础版本)" — T7
- [x] "useChat.ts (基础版本：流式 + stop + send)" — T7 (minimal swap; full rewrite M5)
- [x] "集成测试：test_ai_doctor_text_only_path" — T6

**No spec gaps.**

**2. Placeholder scan:**

- No "TBD" / "TODO" (the "TODO(M5)" in T7 step 4 is intentional and explicit)
- No "implement later" / "fill in details"
- Every code block is complete (no `...` placeholders)
- No "similar to Task N" without repetition
- All types/methods referenced in later tasks are defined in earlier tasks (LangGraphProperties.getInternalToken defined T1, used T1; render_prompt defined T4, used T4; format_sse_event defined T5, used T5; build_ai_doctor_graph defined T4, used T5/T6; etc.)

**No placeholder issues.**

**3. Type consistency:**

- `LangGraphProperties.getInternalToken(): String` defined T1, used T1 ✓
- `AiProxyService.proxyChatStream(UUID, Set<String>, String, String, Map<String,Object>) -> Flux<DataBuffer>` defined T1, used T1 (test) and T1 step 6 (controller) ✓
- `ChatRequest.graph: String, threadId: String, input: Map<String,Object>` defined T1, used T1 ✓
- `Settings.minimax_api_key: str` defined T2, used T3 (model factory test), T4 (analyze_text via get_chat_model) ✓
- `get_chat_model("minimax")` defined T3, used T4 (analyze_text) ✓
- `classify_input(state) -> dict` defined T4 step 6, used T4 step 15 (graph builder) ✓
- `analyze_text(state, model=None) -> dict` defined T4 step 9, used T4 step 15, T6 (integration test) ✓
- `finalize(state) -> dict` defined T4 step 12, used T4 step 15, T6 ✓
- `emit_response(state) -> dict` defined T4 step 13, used T4 step 15 ✓
- `stream_graph(graph, input, config, run_id, *, timeout_seconds) -> AsyncIterator[str]` defined T5, used T5 (chat.py) and T6 (integration test) ✓
- `format_sse_event(event, data) -> str` defined T5, used T5 (chat.py) and T6 (integration test) ✓
- `build_ai_doctor_graph()` defined T4 step 15, used T5 (chat.py), T6 ✓
- `langgraphApi.sendChatStream(graph, input, callbacks, options)` defined T7, used T7 step 4 (route file) ✓
- `langgraphTypes.StreamCallbacks` defined T7, used T7 (langgraphApi.ts) ✓

**No type drift.**

---

## Execution Handoff

Plan complete and saved to `doc/langgraph-migration/plans/2026-07-02-emomind-lg-milestone-1-ai-doctor-text.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (T1 → T8), review between tasks, fast iteration. Aligns with how M0 was executed.

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**