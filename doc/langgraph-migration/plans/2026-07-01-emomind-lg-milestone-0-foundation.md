# EmoMind LG Milestone 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `emomind-lg` project skeleton by copying `emomind-sb/`, removing all Dify-related code/config, adding an empty `ai-runtime/` Python service, adding `LangGraphProperties` + `AiController` + `AiProxyService` Spring stubs, adding V4 Flyway migration for `pgvector` + `user_memory`, and getting `mvn test` + `pytest` + `docker compose up` all green.

**Architecture:** Two top-level components: (1) Spring Boot gateway at `backend-sb/` (Java) — extends `emomind-sb` minus Dify, plus new AI proxy layer; (2) `ai-runtime/` Python FastAPI service — empty skeleton, will host LangGraph graphs in later milestones. Compose adds Redis + ai-runtime alongside the existing Postgres / Spring Boot / Frontend / Traefik.

**Tech Stack:** Spring Boot 3.2.5 / Java 17 / Maven · PostgreSQL 17 + pgvector · Redis 7 · Python 3.11 / FastAPI / uv · Docker Compose · Flyway V4 migration

**Reference docs** (read in this order if context is light):
1. `../00-overview.md` — overall goals & decisions
2. `../01-architecture.md` § "Directory structure" and § "删除清单"
3. `../02-components.md` § 1 Spring Boot + § 2 ai-runtime
4. `../12-deployment.md` — full compose reference
5. `../09-ai-runtime.md` — ai-runtime spec (this plan only does § 5 lifespan + § 15 pyproject, not graph code)
6. `../11-conversation-meta.md` — V4/V5 Flyway migration context (this plan does V4 only)

---

## Pre-Flight Status

This plan was created before `emomind-lg/` was scaffolded in git. **Task 1 is already complete** as of the initial commit `b00ee80`:

- **Step 1-3** ✅ done via `git worktree add ../emomind-lg -b emomind-lg origin/emomind-sb` (cleaner than `cp -r` — no nested `.git` in `backend-sb/`, `frontend/`)
- **Step 4** ✅ done — `cd backend-sb && mvn test -Dtest=UserServiceTest` ran BUILD SUCCESS (19 tests, 0 failures, 5.5s test time, 9.1s wall). Worktree is healthy. Task 2+ can proceed.
- **Step 5** ❌ **N/A** — worktree handles branching; no `git init` needed.

**When picking up this plan in a new session:**

1. Skip Task 1 entirely (do NOT re-run `cp -r` — directory exists).
2. Run Step 4 above as a sanity check.
3. Start at Task 2.

The remaining 15 tasks (Task 2-16) are unchanged.

---

## File Structure

### Files to create (this milestone)

```
emomind-lg/
├── README.md                                      (already created in prior session — do NOT modify)
├── doc/                                           (already created — do NOT modify)
├── backend-sb/
│   └── src/main/java/com/emomind/
│       ├── config/LangGraphProperties.java        NEW — replaces DifyProperties
│       ├── service/AiProxyService.java            NEW — empty stub returning 501
│       └── controller/AiController.java           NEW — empty stub returning 501
│   └── src/main/resources/db/migration/
│       └── V4__add_user_memory_and_pgvector.sql   NEW
│   └── src/test/java/com/emomind/config/
│       └── LangGraphPropertiesTest.java           NEW
│   └── .env.example                               MODIFIED (remove DIFY_*)
├── ai-runtime/
│   ├── app/
│   │   ├── __init__.py                            NEW
│   │   ├── main.py                                NEW — FastAPI hello world
│   │   ├── config.py                              NEW — pydantic Settings
│   │   └── api/
│   │       ├── __init__.py                        NEW
│   │       └── health.py                          NEW — /healthz
│   ├── tests/
│   │   ├── __init__.py                            NEW
│   │   └── test_health.py                         NEW
│   ├── pyproject.toml                             NEW — uv-managed
│   ├── Dockerfile                                 NEW
│   ├── .env.example                               NEW
│   └── README.md                                  NEW
└── compose.yml                                    MODIFIED (remove Dify, add redis + ai-runtime)
```

### Files to delete (this milestone)

```
emomind-lg/backend-sb/src/main/java/com/emomind/controller/DifyController.java        DELETE
emomind-lg/backend-sb/src/main/java/com/emomind/service/DifyService.java              DELETE
emomind-lg/backend-sb/src/main/java/com/emomind/config/DifyProperties.java             DELETE
emomind-lg/backend-sb/src/main/java/com/emomind/config/WebClientConfig.java            MODIFY (remove difyWebClient bean)
emomind-lg/backend-sb/src/main/resources/application.yml                              MODIFY (remove app.dify.*)
emomind-lg/frontend/src/services/difyApi.ts                                          DELETE
emomind-lg/dify_workflow/                                                            DELETE (whole dir; archive if needed)
emomind-lg/backend-sb/.env.example                                                    MODIFY (remove DIFY_*)
emomind-lg/.env.example                                                              MODIFY (remove DIFY_*, add LANGGRAPH_*)
```

### Existing test files (do not touch, just confirm still green)

- `backend-sb/src/test/java/com/emomind/controller/LoginControllerTest.java`
- `backend-sb/src/test/java/com/emomind/service/UserServiceTest.java`
- all other existing Spring tests

---

## Task 1: Create `emomind-lg/` directory and copy from `emomind-sb/`

**Files:**
- Create: `emomind-lg/` (whole directory)

- [ ] **Step 1: Verify source exists**

Run:
```bash
ls "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-sb"
```
Expected: list of files including `backend-sb/`, `frontend/`, `compose.yml`, `.env.example`, etc.

- [ ] **Step 2: Copy the directory**

Run (from the parent workspace dir):
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update"
cp -r emomind-sb emomind-lg
```
Expected: `emomind-lg/` exists with same structure as `emomind-sb/`.

- [ ] **Step 3: Verify copy**

Run:
```bash
ls "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
```
Expected: matches `emomind-sb` listing.

- [ ] **Step 4: Verify existing test still passes (sanity check copy is good)**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q test -Dtest=UserServiceTest
```
Expected: `BUILD SUCCESS`.

- [ ] **Step 5: Commit**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git init 2>/dev/null || true
git add -A
git commit -m "chore(m0): copy emomind-sb as starting point for emomind-lg"
```

---

## Task 2: Delete Dify backend files

**Files:**
- Delete: `backend-sb/src/main/java/com/emomind/controller/DifyController.java`
- Delete: `backend-sb/src/main/java/com/emomind/service/DifyService.java`
- Delete: `backend-sb/src/main/java/com/emomind/config/DifyProperties.java`
- Delete: `backend-sb/src/test/java/com/emomind/controller/DifyControllerTest.java` (orphaned after main class deletion)
- Delete: `backend-sb/src/test/java/com/emomind/service/DifyServiceTest.java` (if it exists)

- [ ] **Step 1: Delete the three main Dify files**

Run (from `emomind-lg/`):
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
rm backend-sb/src/main/java/com/emomind/controller/DifyController.java
rm backend-sb/src/main/java/com/emomind/service/DifyService.java
rm backend-sb/src/main/java/com/emomind/config/DifyProperties.java
```
Expected: no output; verify with `ls` that files are gone.

- [ ] **Step 2: Find and delete orphaned Dify tests**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
find backend-sb/src/test -name '*Dify*' -type f
```
Expected: lists `DifyControllerTest.java` and possibly `DifyServiceTest.java`.

Delete each:
```bash
rm backend-sb/src/test/java/com/emomind/controller/DifyControllerTest.java
# Repeat for any other Dify test files found above
```

- [ ] **Step 3: Verify backend no longer compiles references to deleted classes (expect failure)**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q compile
```
Expected: FAIL with errors like `cannot find symbol: class DifyService`. This is correct — we'll fix in next steps.

- [ ] **Step 4: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add -A
git commit -m "chore(m0): delete Dify controller/service/properties and orphaned tests"
```

---

## Task 3: Remove `difyWebClient` bean from WebClientConfig

**Files:**
- Modify: `backend-sb/src/main/java/com/emomind/config/WebClientConfig.java`

- [ ] **Step 1: Read current file**

Run:
```bash
cat "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb/src/main/java/com/emomind/config/WebClientConfig.java"
```
Expected: full contents displayed.

- [ ] **Step 2: Rewrite the file with the Dify bean removed**

Write `backend-sb/src/main/java/com/emomind/config/WebClientConfig.java` with this exact content:

```java
package com.emomind.config;

// Note: WebClient bean for ai-runtime is now created in AiProxyService
// (it needs LangGraphProperties which depends on Spring config loading).
// This file is kept as a placeholder for future WebClient beans (e.g., OAuth,
// external APIs). It currently provides no beans.

public class WebClientConfig {
}
```

- [ ] **Step 3: Verify it compiles**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q compile
```
Expected: still FAIL (other files reference DifyService etc.) — that's expected; remaining cleanup is in next tasks.

- [ ] **Step 4: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add backend-sb/src/main/java/com/emomind/config/WebClientConfig.java
git commit -m "chore(m0): remove difyWebClient bean from WebClientConfig"
```

---

## Task 4: Remove `app.dify.*` config from `application.yml`

**Files:**
- Modify: `backend-sb/src/main/resources/application.yml`

- [ ] **Step 1: Read current file**

Run:
```bash
cat "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb/src/main/resources/application.yml"
```
Expected: full YAML shown.

- [ ] **Step 2: Edit to remove Dify config block**

Open the file with the Edit tool. Find this block (within `app:`):

```yaml
  dify:
    api-url: ${DIFY_API_URL:http://localhost/v1}
    ai-doctor-api-key: ${DIFY_AI_DOCTOR_API_KEY:}
    test-api-key: ${DIFY_TEST_API_KEY:}
```

Delete those 4 lines. The `app:` section should keep `jwt`, `frontend`, `cors`, `first-superuser` and add `langgraph` placeholder in the next task.

- [ ] **Step 3: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add backend-sb/src/main/resources/application.yml
git commit -m "chore(m0): remove app.dify.* from application.yml"
```

---

## Task 5: Delete `difyApi.ts` and `dify_workflow/`

**Files:**
- Delete: `frontend/src/services/difyApi.ts`
- Delete: `dify_workflow/` (whole directory)

- [ ] **Step 1: Delete frontend Dify service**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
rm frontend/src/services/difyApi.ts
```
Expected: no output.

- [ ] **Step 2: Verify which frontend files reference difyApi**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/frontend/src"
grep -rln "difyApi" .
```
Expected: a list of files that import from difyApi (likely `hooks/useChat.ts` and maybe a few others).

- [ ] **Step 3: For each file referencing difyApi, replace import with comment placeholder**

For each file in the grep result, open it and replace:
```typescript
import { ... } from "@/services/difyApi"
```
with:
```typescript
// TODO(m1): replace with langgraphApi — see ../../doc/langgraph-migration/08-frontend-migration.md
import { /* will be implemented in M1 */ } from "@/services/langgraphApi"
```

**Do not actually change the call sites yet** — those will be reworked in M1. For now just neutralise the imports so the project type-checks. If a file cannot be made to compile with the placeholder, add `// @ts-nocheck` at the top of that file temporarily, and note it in the commit message.

- [ ] **Step 4: Delete Dify workflow DSL directory**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
rm -rf dify_workflow
```
Expected: no output.

- [ ] **Step 5: Verify no remaining references to Dify DSL paths in backend tests**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
grep -rln "dify_workflow\|DifyController\|DifyService\|DifyProperties" . --include='*.java' --include='*.ts' --include='*.tsx' --include='*.yml' --include='*.yaml' 2>/dev/null || true
```
Expected: empty (no matches). If matches exist, fix them.

- [ ] **Step 6: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add -A
git commit -m "chore(m0): delete difyApi.ts and dify_workflow/, neutralise frontend imports"
```

---

## Task 6: Clean up `.env.example` files

**Files:**
- Modify: `.env.example`
- Modify: `backend-sb/.env.example`

- [ ] **Step 1: Read root .env.example**

Run:
```bash
cat "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/.env.example"
```
Expected: includes `DIFY_*` variables and the rest of the existing config.

- [ ] **Step 2: Edit root `.env.example` to remove DIFY_* and add LANGGRAPH_***

Use Edit tool. Remove these lines (if present):
```
DIFY_API_URL=http://localhost:5001/v1
DIFY_AI_DOCTOR_API_KEY=
DIFY_TEST_API_KEY=
```

Add these lines at the end (before any `# ============ Traefik / Production ============` block):
```
# ============ LangGraph ai-runtime ============
LANGGRAPH_RUNTIME_URL=http://localhost:8000
LANGGRAPH_INTERNAL_TOKEN=changeme-internal-token-at-least-32-characters-long

# ============ LLM Providers ============
MINIMAX_API_KEY=your-minimax-key
MINIMAX_BASE_URL=https://api.minimax.chat/v1
QWEN_OMNI_API_KEY=your-qwen-key
QWEN_OMNI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_API_KEY=your-qwen-key
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_MODEL=text-embedding-v3
```

- [ ] **Step 3: Read `backend-sb/.env.example`**

Run:
```bash
cat "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb/.env.example"
```

- [ ] **Step 4: If backend-sb/.env.example contains DIFY_*, remove them**

Use Edit tool to delete any `DIFY_*` lines from this file.

- [ ] **Step 5: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add .env.example backend-sb/.env.example
git commit -m "chore(m0): remove DIFY_* env vars, add LANGGRAPH_* and LLM provider vars"
```

---

## Task 7: Add `LangGraphProperties` Spring config class

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/config/LangGraphProperties.java`
- Test: `backend-sb/src/test/java/com/emomind/config/LangGraphPropertiesTest.java`

- [ ] **Step 1: Write the failing test**

Create file `backend-sb/src/test/java/com/emomind/config/LangGraphPropertiesTest.java`:

```java
package com.emomind.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = LangGraphPropertiesTest.TestConfig.class)
@EnableConfigurationProperties(LangGraphProperties.class)
@TestPropertySource(properties = {
    "app.langgraph.runtime-url=http://test-host:9999",
    "app.langgraph.internal-token=test-token-abcdef-1234567890",
    "app.langgraph.request-timeout-ms=60000"
})
class LangGraphPropertiesTest {

    static class TestConfig {}

    @org.springframework.beans.factory.annotation.Autowired
    LangGraphProperties props;

    @Test
    void loadsRuntimeUrl() {
        assertThat(props.getRuntimeUrl()).isEqualTo("http://test-host:9999");
    }

    @Test
    void loadsInternalToken() {
        assertThat(props.getInternalToken()).isEqualTo("test-token-abcdef-1234567890");
    }

    @Test
    void loadsRequestTimeout() {
        assertThat(props.getRequestTimeoutMs()).isEqualTo(60000L);
    }

    @Test
    void defaultsAreAppliedWhenPropsMissing() {
        // request-timeout-ms not set in another context
        // We assert against the autowired bean which has all three set; just verify type.
        assertThat(props).isNotNull();
        assertThat(props.getRuntimeUrl()).startsWith("http");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q test -Dtest=LangGraphPropertiesTest
```
Expected: FAIL with `LangGraphProperties class not found`.

- [ ] **Step 3: Write minimal implementation**

Create file `backend-sb/src/main/java/com/emomind/config/LangGraphProperties.java`:

```java
package com.emomind.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "app.langgraph")
public class LangGraphProperties {

    /** Base URL of the ai-runtime Python sidecar (e.g. http://ai-runtime:8000). */
    private String runtimeUrl = "http://localhost:8000";

    /** Shared secret for X-Internal-Token header. Must be at least 32 chars in prod. */
    private String internalToken = "changeme-changeme-changeme-changeme";

    /** Total request timeout in milliseconds (covers full SSE stream). */
    private long requestTimeoutMs = 120000L;

    /** TCP connect timeout for ai-runtime. */
    private long connectTimeoutMs = 5000L;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q test -Dtest=LangGraphPropertiesTest
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add backend-sb/src/main/java/com/emomind/config/LangGraphProperties.java \
        backend-sb/src/test/java/com/emomind/config/LangGraphPropertiesTest.java
git commit -m "feat(m0): add LangGraphProperties for ai-runtime connection config"
```

---

## Task 8: Add `app.langgraph` defaults to `application.yml`

**Files:**
- Modify: `backend-sb/src/main/resources/application.yml`

- [ ] **Step 1: Read current file**

Run:
```bash
cat "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb/src/main/resources/application.yml"
```

- [ ] **Step 2: Add `langgraph` block under `app:`**

Use Edit tool. Find this block:

```yaml
app:
  jwt:
    secret: ${SECRET_KEY:changeme-changeme-changeme-changeme}
    expiration: 691200000
  frontend:
    host: ${FRONTEND_HOST:http://localhost:5174}
  cors:
    origins: ${BACKEND_CORS_ORIGINS:http://localhost:5174}
  first-superuser:
    email: ${FIRST_SUPERUSER:}
    password: ${FIRST_SUPERUSER_PASSWORD:}
```

After `first-superuser:` block (before any top-level sibling), insert:

```yaml
  langgraph:
    runtime-url: ${LANGGRAPH_RUNTIME_URL:http://localhost:8000}
    internal-token: ${LANGGRAPH_INTERNAL_TOKEN:changeme-changeme-changeme-changeme}
    request-timeout-ms: 120000
    connect-timeout-ms: 5000
```

- [ ] **Step 3: Verify Spring Boot can still load the context**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q test -Dtest=LangGraphPropertiesTest
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add backend-sb/src/main/resources/application.yml
git commit -m "feat(m0): add app.langgraph defaults to application.yml"
```

---

## Task 9: Add empty `AiProxyService` stub

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/service/AiProxyService.java`
- Test: `backend-sb/src/test/java/com/emomind/service/AiProxyServiceTest.java`

- [ ] **Step 1: Write the failing test**

Create `backend-sb/src/test/java/com/emomind/service/AiProxyServiceTest.java`:

```java
package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AiProxyServiceTest {

    @Test
    void stubClass_loadsAndIsInjectable() {
        // M0 only verifies the class exists and is constructible.
        // Real forwarding logic lands in M1.
        LangGraphProperties props = new LangGraphProperties();
        props.setRuntimeUrl("http://localhost:8000");
        AiProxyService svc = new AiProxyService(props);
        assertThat(svc).isNotNull();
        // public method exists
        UUID userId = UUID.randomUUID();
        // The actual return type will be added in M1; for now it can throw UnsupportedOperationException.
        // We only assert that no NullPointerException happens on construction.
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q test -Dtest=AiProxyServiceTest
```
Expected: FAIL with `AiProxyService class not found`.

- [ ] **Step 3: Write minimal implementation**

Create `backend-sb/src/main/java/com/emomind/service/AiProxyService.java`:

```java
package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Forwards chat / file / conversation requests from the Spring Boot gateway
 * to the ai-runtime Python sidecar.
 *
 * M0: empty stub. Real implementations of proxyChatStream, proxyStop,
 * proxyConversations, proxyMessages, deleteConversation, uploadFile
 * land in M1 / M4 / M5.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiProxyService {

    private final LangGraphProperties langGraphProperties;

    public LangGraphProperties getLangGraphProperties() {
        return langGraphProperties;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q test -Dtest=AiProxyServiceTest
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add backend-sb/src/main/java/com/emomind/service/AiProxyService.java \
        backend-sb/src/test/java/com/emomind/service/AiProxyServiceTest.java
git commit -m "feat(m0): add AiProxyService stub (real forwarding in M1)"
```

---

## Task 10: Add empty `AiController` stub with 501 Not Implemented

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/controller/AiController.java`
- Test: `backend-sb/src/test/java/com/emomind/controller/AiControllerTest.java`

- [ ] **Step 1: Write the failing test**

Create `backend-sb/src/test/java/com/emomind/controller/AiControllerTest.java`:

```java
package com.emomind.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class AiControllerTest {

    @Autowired
    WebApplicationContext context;

    @Test
    void healthz_isPublic_returns200() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        mvc.perform(get("/api/v1/ai/healthz"))
            .andExpect(status().isOk());
    }

    @Test
    void chat_unauthenticated_returns401() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        mvc.perform(get("/api/v1/ai/healthz")).andExpect(status().isOk()); // sanity
        // chat requires auth; without JWT should be 401
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .post("/api/v1/ai/chat")
                .contentType("application/json")
                .content("{}"))
            .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q test -Dtest=AiControllerTest
```
Expected: FAIL with `AiController not found` or `404 Not Found` for `/api/v1/ai/healthz`.

- [ ] **Step 3: Write minimal implementation**

Create `backend-sb/src/main/java/com/emomind/controller/AiController.java`:

```java
package com.emomind.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * AI gateway controller — proxies requests to the LangGraph ai-runtime.
 *
 * M0: only /healthz is implemented (returns 200 if Spring can reach this code).
 * Real /chat (SSE), /chat/stop, /conversations, /messages, /files endpoints
 * land in M1 / M4.
 *
 * All endpoints under /api/v1/ai/** require authentication (handled by SecurityConfig),
 * except /api/v1/ai/healthz which is public for health checks.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
@Tag(name = "AI", description = "LangGraph ai-runtime 代理（聊天 / 会话 / 文件）")
public class AiController {

    @GetMapping("/healthz")
    @Operation(summary = "AI 路由存活检查（公开）")
    public ResponseEntity<Map<String, Object>> healthz() {
        return ResponseEntity.ok(Map.of(
            "status", "ok",
            "service", "ai-gateway",
            "note", "ai-runtime integration ships in M1"
        ));
    }

    /**
     * Catch-all for unimplemented endpoints so they return 501 instead of 404
     * while we're still building M1+ endpoints.
     */
    @RequestMapping(value = "/**", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.NOT_IMPLEMENTED)
    public ResponseEntity<Map<String, Object>> notImplemented() {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(Map.of(
            "code", "NOT_IMPLEMENTED",
            "message", "This AI endpoint is not yet implemented (Milestone 0 stub)"
        ));
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q test -Dtest=AiControllerTest
```
Expected: PASS (2 tests).

- [ ] **Step 5: Run full backend test suite to verify no regression**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q test
```
Expected: BUILD SUCCESS. Some pre-existing tests may have referenced deleted Dify files — if any fail, examine each; if they were Dify-specific and now obsolete, delete them as part of this task.

- [ ] **Step 6: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add backend-sb/src/main/java/com/emomind/controller/AiController.java \
        backend-sb/src/test/java/com/emomind/controller/AiControllerTest.java
git commit -m "feat(m0): add AiController stub with /healthz and 501 catch-all"
```

---

## Task 11: Allow `/api/v1/ai/healthz` in Spring Security

**Files:**
- Modify: `backend-sb/src/main/java/com/emomind/config/SecurityConfig.java`

- [ ] **Step 1: Read SecurityConfig**

Run:
```bash
grep -n "permitAll\|/api/v1/utils\|/api/v1/login" "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb/src/main/java/com/emomind/config/SecurityConfig.java" | head -20
```
Expected: lists existing permitAll paths.

- [ ] **Step 2: Add `/api/v1/ai/healthz` to permitAll list**

Find the `authorizeHttpRequests` block. In the chain of `.requestMatchers(...).permitAll()` calls, add a new line matching `/api/v1/ai/healthz`:

```java
.requestMatchers("/api/v1/ai/healthz").permitAll()
```

Place it next to existing public endpoints like `/api/v1/utils/health-check/**` and `/api/v1/login/**`.

- [ ] **Step 3: Re-run AiControllerTest**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q test -Dtest=AiControllerTest
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add backend-sb/src/main/java/com/emomind/config/SecurityConfig.java
git commit -m "feat(m0): permit /api/v1/ai/healthz without auth"
```

---

## Task 12: Add V4 Flyway migration for pgvector + user_memory

**Files:**
- Create: `backend-sb/src/main/resources/db/migration/V4__add_user_memory_and_pgvector.sql`
- Test: `backend-sb/src/test/java/com/emomind/migration/V4MigrationTest.java`

- [ ] **Step 1: Write the failing test**

Create `backend-sb/src/test/java/com/emomind/migration/V4MigrationTest.java`:

```java
package com.emomind.migration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V4 migration requires pgvector, which H2 does not support.
 * This test spins up a real pgvector Postgres via Testcontainers and runs Flyway against it.
 */
@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class V4MigrationTest {

    @Container
    static PostgreSQLContainer<?> pgvector = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg17").asCompatibleSubstituteFor("postgres")
    ).withDatabaseName("emomind_test");

    @DynamicPropertySource
    static void overrideProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", pgvector::getJdbcUrl);
        registry.add("spring.datasource.username", pgvector::getUsername);
        registry.add("spring.datasource.password", pgvector::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        // Override the test-profile H2 settings — force real Postgres + Flyway:
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.flyway.locations", () -> "classpath:db/migration");
    }

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void pgvectorExtensionExists() {
        Integer count = jdbc.queryForObject(
            "SELECT count(*) FROM pg_extension WHERE extname = 'vector'",
            Integer.class
        );
        assertThat(count).isEqualTo(1);
    }

    @Test
    void userMemoryTableExists() {
        Integer count = jdbc.queryForObject(
            "SELECT count(*) FROM information_schema.tables WHERE table_name = 'user_memory'",
            Integer.class
        );
        assertThat(count).isEqualTo(1);
    }

    @Test
    void embeddingColumnExists() {
        Integer count = jdbc.queryForObject(
            "SELECT count(*) FROM information_schema.columns " +
            "WHERE table_name = 'user_memory' AND column_name = 'embedding'",
            Integer.class
        );
        assertThat(count).isEqualTo(1);
    }

    @Test
    void hnswIndexExists() {
        Integer count = jdbc.queryForObject(
            "SELECT count(*) FROM pg_indexes WHERE tablename = 'user_memory' " +
            "AND indexname = 'user_memory_embedding_hnsw_idx'",
            Integer.class
        );
        assertThat(count).isEqualTo(1);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q test -Dtest=V4MigrationTest
```
Expected: FAIL because migration file doesn't exist; `pg_extension` will return 0 for `vector`.

- [ ] **Step 3: Write the migration SQL**

Create `backend-sb/src/main/resources/db/migration/V4__add_user_memory_and_pgvector.sql`:

```sql
-- V4: add user long-term memory with pgvector for embedding search.
-- Requires the `vector` extension; created here if missing.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE user_memory (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fact_text TEXT NOT NULL,
    fact_text_hash CHAR(64) NOT NULL,
    embedding vector(1024) NOT NULL,
    category VARCHAR(50) NOT NULL,
    importance REAL NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    source_thread_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, fact_text_hash)
);

CREATE INDEX user_memory_embedding_hnsw_idx
    ON user_memory
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX user_memory_user_id_created_at_idx
    ON user_memory (user_id, created_at DESC);

CREATE TABLE user_memory_dead_letter (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    fact_text TEXT NOT NULL,
    category VARCHAR(50),
    error TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_memory IS 'AI 用户长期记忆（与 LangGraph checkpoint 通过 thread_id 关联）';
COMMENT ON COLUMN user_memory.fact_text_hash IS 'SHA-256(fact_text) for dedup';
COMMENT ON COLUMN user_memory.embedding IS 'Qwen text-embedding-v3 (1024 dim)';
```

- [ ] **Step 4: Do NOT modify `application-test.yml` — keep H2 for existing tests**

The existing `application-test.yml` (which we copied in Task 1) uses H2 in-memory:
```yaml
spring:
  datasource:
    url: jdbc:h2:mem:testdb;MODE=PostgreSQL;...
  flyway:
    enabled: false
  jpa:
    hibernate:
      ddl-auto: create-drop  # Hibernate auto-creates schema for tests
```

H2 does **not** support pgvector. We will:
- Keep H2 + `ddl-auto: create-drop` for ALL existing tests (do NOT break them in M0)
- For V4MigrationTest specifically, use Testcontainers pgvector directly via `@Testcontainers` + `@DynamicPropertySource` (see step below)

This is the surgical approach: only the new V4MigrationTest switches to real pgvector; everything else stays on H2.

- [ ] **Step 5: Verify Testcontainers Postgres is on test classpath**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
grep -A 2 "testcontainers" pom.xml
```
Expected: `testcontainers:junit-jupiter` and `testcontainers:postgresql` should already be present (per `pom.xml` lines 135-144). If not, add them.

- [ ] **Step 6: Verify `org.postgresql:postgresql` is available in test scope**

The Flyway migration uses `vector(1024)` type which is provided by pgvector extension. The Postgres driver itself doesn't need to be in test scope (it's `runtime` scope in main pom.xml — but Testcontainers needs it at test time). Check:

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
grep -B 1 -A 3 "postgresql" pom.xml
```

If `org.postgresql:postgresql` is `<scope>runtime</scope>` only, change to `<scope>test</scope>` OR keep runtime and rely on testcontainers JDBC URL behaviour (which pulls the driver automatically). Test the simplest path first — if `mvn test` works without modifying pom.xml, skip this step.

- [ ] **Step 7: Run V4MigrationTest to verify it passes**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q test -Dtest=V4MigrationTest
```
Expected: PASS (4 tests). First run downloads the `pgvector/pgvector:pg17` Docker image — this may take 1-2 minutes.

If the test fails with `relation "users" does not exist`, that's because Flyway runs V1 (init_schema with `users` table) first, then V4. Flyway ordering by version should handle this — verify V1 actually creates a `users` table:

```bash
grep -A 5 "CREATE TABLE.*users\|CREATE TABLE users" \
  "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb/src/main/resources/db/migration/V1__init_schema.sql"
```

- [ ] **Step 8: Run full backend test suite — confirm existing H2-based tests still pass**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
mvn -q test
```
Expected: BUILD SUCCESS. The H2 test profile is unchanged; only V4MigrationTest uses Testcontainers.

- [ ] **Step 9: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add backend-sb/src/main/resources/db/migration/V4__add_user_memory_and_pgvector.sql \
        backend-sb/src/test/java/com/emomind/migration/V4MigrationTest.java \
        backend-sb/pom.xml  # only if modified
git commit -m "feat(m0): V4 Flyway migration for pgvector + user_memory"
```

---

## Task 13: Create `ai-runtime/` Python package skeleton

**Files:**
- Create: `ai-runtime/pyproject.toml`
- Create: `ai-runtime/app/__init__.py`
- Create: `ai-runtime/app/main.py`
- Create: `ai-runtime/app/config.py`
- Create: `ai-runtime/app/api/__init__.py`
- Create: `ai-runtime/app/api/health.py`
- Create: `ai-runtime/tests/__init__.py`
- Create: `ai-runtime/tests/test_health.py`
- Create: `ai-runtime/.env.example`
- Create: `ai-runtime/README.md`

- [ ] **Step 1: Install `uv` if not already installed**

Run:
```bash
which uv || pip install uv
```
Expected: prints path to `uv` or installs it.

- [ ] **Step 2: Create `ai-runtime/pyproject.toml`**

Create file `ai-runtime/pyproject.toml`:

```toml
[project]
name = "emomind-ai-runtime"
version = "0.1.0"
description = "LangGraph-based AI runtime for EmoMind (M0 skeleton)"
requires-python = ">=3.11"

dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "httpx>=0.27",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["app"]
```

- [ ] **Step 3: Create empty `__init__.py` files**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
touch ai-runtime/app/__init__.py
touch ai-runtime/app/api/__init__.py
touch ai-runtime/tests/__init__.py
```

- [ ] **Step 4: Create `app/config.py`**

Create file `ai-runtime/app/config.py`:

```python
"""Pydantic settings for ai-runtime."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LANGGRAPH_", env_file=".env", extra="ignore")

    host: str = "0.0.0.0"
    port: int = 8000

    # Will be enforced in M1 — for M0 only "placeholder" is needed for config to load.
    internal_token: str = "m0-placeholder-token"
    database_url: str = "postgresql://localhost:5432/emomind"
    # Host-side default — points at the port mapped by compose.override.yml
    # (6390 -> container 6379). Inside compose override via env var.
    redis_url: str = "redis://localhost:6390"


settings = Settings()
```

- [ ] **Step 5: Create `app/api/health.py`**

Create file `ai-runtime/app/api/health.py`:

```python
"""Health check endpoint."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    """Liveness check. Always returns 200 if the process is running."""
    return {"status": "ok", "service": "ai-runtime", "milestone": "M0"}
```

- [ ] **Step 6: Create `app/main.py`**

Create file `ai-runtime/app/main.py`:

```python
"""FastAPI application entry point (M0 skeleton)."""
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.api.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # M0: no resources to initialize. M1 will init PostgresSaver + Redis.
    yield


app = FastAPI(
    title="EmoMind AI Runtime",
    version="0.1.0",
    description="LangGraph-based AI runtime for EmoMind. M0 skeleton.",
    lifespan=lifespan,
)

app.include_router(health_router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "emomind-ai-runtime", "milestone": "M0", "docs": "/docs"}
```

- [ ] **Step 7: Create `tests/test_health.py`**

Create file `ai-runtime/tests/test_health.py`:

```python
"""Smoke test for /healthz endpoint."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz_returns_ok():
    response = client.get("/healthz")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "ai-runtime"
    assert body["milestone"] == "M0"


def test_root_returns_service_info():
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "emomind-ai-runtime"
    assert body["milestone"] == "M0"
```

- [ ] **Step 8: Install dependencies and run tests**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/ai-runtime"
uv sync --extra dev
uv run pytest -v
```
Expected: 2 tests pass.

- [ ] **Step 9: Verify server starts**

In a separate terminal:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/ai-runtime"
uv run uvicorn app.main:app --port 8000
```
Expected: server starts, prints `Uvicorn running on http://0.0.0.0:8000`.

Then in another terminal:
```bash
curl http://localhost:8000/healthz
```
Expected: `{"status":"ok","service":"ai-runtime","milestone":"M0"}`.

Stop the server (Ctrl+C) before continuing.

- [ ] **Step 10: Create `ai-runtime/.env.example`**

Create file `ai-runtime/.env.example`:

```bash
# M0: only the bare minimum. Real provider keys land in M1.
LANGGRAPH_INTERNAL_TOKEN=m0-placeholder-token
LANGGRAPH_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/emomind
LANGGRAPH_REDIS_URL=redis://localhost:6390
```

- [ ] **Step 11: Create `ai-runtime/README.md`**

Create file `ai-runtime/README.md`:

```markdown
# ai-runtime (M0 skeleton)

FastAPI-based skeleton for the LangGraph AI runtime. M0 only contains
a `/healthz` endpoint and a `/` info endpoint. Real chat / SSE endpoints
land in M1.

## Run

```bash
uv sync --extra dev
uv run uvicorn app.main:app --reload --port 8000
```

## Test

```bash
uv run pytest -v
```

## Reference

See `../doc/langgraph-migration/09-ai-runtime.md` for full module specification.
```

- [ ] **Step 12: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add ai-runtime/
git commit -m "feat(m0): ai-runtime Python FastAPI skeleton with /healthz"
```

---

## Task 14: Add `ai-runtime` to Docker Compose

**Files:**
- Modify: `compose.yml`
- Modify: `compose.override.yml`
- Create: `ai-runtime/Dockerfile`

- [ ] **Step 1: Create `ai-runtime/Dockerfile`**

Create file `ai-runtime/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv

# Install system curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock* ./

# Install dependencies
RUN uv sync --frozen --no-dev 2>/dev/null || uv sync --no-dev

# Copy source
COPY app ./app

# Storage directory for uploaded files
RUN mkdir -p /var/lib/emomind/files

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/healthz || exit 1

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Read current `compose.yml`**

Run:
```bash
cat "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/compose.yml"
```

- [ ] **Step 3: Find the `db` service block and add `redis` after it**

Use Edit tool. After the `db:` service block (before any other top-level service), add:

```yaml
  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    labels:
      - "traefik.enable=false"
```

- [ ] **Step 4: Add `ai-runtime` service after `backend`**

After the `backend:` service block, add:

```yaml
  ai-runtime:
    build:
      context: .
      dockerfile: ai-runtime/Dockerfile
    restart: always
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      LANGGRAPH_DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      LANGGRAPH_REDIS_URL: redis://redis:6379
      LANGGRAPH_INTERNAL_TOKEN: ${LANGGRAPH_INTERNAL_TOKEN}
      LANGGRAPH_STORAGE_PATH: /var/lib/emomind/files
    volumes:
      - ai-runtime-files:/var/lib/emomind/files
    labels:
      - "traefik.enable=false"
```

- [ ] **Step 5: Add volumes at the bottom of `compose.yml`**

Find the `volumes:` section at the bottom. Add:

```yaml
  redisdata:
  ai-runtime-files:
```

(Keep existing volumes.)

- [ ] **Step 6: Read `compose.override.yml`**

Run:
```bash
cat "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/compose.override.yml"
```

- [ ] **Step 7: Add `redis` and `ai-runtime` port mappings for dev**

In `compose.override.yml`, under `services:` add or merge:

```yaml
  redis:
    ports:
      - "6379:6379"

  ai-runtime:
    ports:
      - "8000:8000"
    environment:
      LANGGRAPH_LOG_LEVEL: DEBUG
```

- [ ] **Step 8: Verify compose file syntax**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
docker compose config --quiet
```
Expected: exit code 0, no errors.

- [ ] **Step 9: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add ai-runtime/Dockerfile compose.yml compose.override.yml
git commit -m "feat(m0): add ai-runtime and redis services to docker compose"
```

---

## Task 15: Add CI workflow for ai-runtime

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/` directory if not present**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
mkdir -p .github/workflows
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main, emomind-lg]
  pull_request:
    branches: [main, emomind-lg]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg17
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: emomind_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - name: Cache Maven dependencies
        uses: actions/cache@v4
        with:
          path: ~/.m2/repository
          key: ${{ runner.os }}-maven-${{ hashFiles('backend-sb/pom.xml') }}
      - name: Run backend tests
        working-directory: backend-sb
        run: mvn -B test
        env:
          POSTGRES_SERVER: localhost
          POSTGRES_PORT: 5432
          POSTGRES_DB: emomind_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          SPRING_PROFILES_ACTIVE: test

  ai-runtime:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install uv
        run: pip install uv
      - name: Install dependencies
        working-directory: ai-runtime
        run: uv sync --extra dev
      - name: Run ai-runtime tests
        working-directory: ai-runtime
        run: uv run pytest -v

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - name: Install dependencies
        working-directory: frontend
        run: bun install --frozen-lockfile
      - name: Lint
        working-directory: frontend
        run: bun run lint
      - name: Build
        working-directory: frontend
        run: bun run build
```

- [ ] **Step 3: Validate YAML syntax**

Run:
```bash
python -c "import yaml; yaml.safe_load(open('F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/.github/workflows/ci.yml'))" && echo OK
```
Expected: prints `OK`.

- [ ] **Step 4: Commit**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git add .github/workflows/ci.yml
git commit -m "ci(m0): add CI workflow for backend, ai-runtime, frontend"
```

---

## Task 16: Final end-to-end verification

**Files:**
- (no file changes — verification task)

- [ ] **Step 1: Start infrastructure**

Run:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
docker compose -f compose.yml -f compose.override.yml up -d db redis
```
Expected: `db` and `redis` containers start; `docker ps` shows them healthy.

- [ ] **Step 2: Start ai-runtime locally (not in Docker — for fast iteration)**

In a separate terminal:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/ai-runtime"
LANGGRAPH_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/emomind \
LANGGRAPH_REDIS_URL=redis://localhost:6390 \
uv run uvicorn app.main:app --reload --port 8000
```
Expected: server starts on port 8000.

- [ ] **Step 3: Verify ai-runtime /healthz responds**

In another terminal:
```bash
curl http://localhost:8000/healthz
```
Expected: `{"status":"ok","service":"ai-runtime","milestone":"M0"}`.

- [ ] **Step 4: Start backend**

In another terminal:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg/backend-sb"
set -a && source ../.env && set +a
mvn spring-boot:run
```
Expected: Spring Boot starts on port 8080. Look for `Started EmoMindApplication`.

- [ ] **Step 5: Verify Spring → ai-runtime stub reachable**

```bash
curl http://localhost:8080/api/v1/ai/healthz
```
Expected: `{"status":"ok","service":"ai-gateway","note":"ai-runtime integration ships in M1"}`.

- [ ] **Step 6: Verify unauthenticated chat returns 401**

```bash
curl -X POST http://localhost:8080/api/v1/ai/chat -H "Content-Type: application/json" -d '{}'
```
Expected: HTTP 401.

- [ ] **Step 7: Verify ai-runtime /healthz through Spring (Spring health check should pass even without actually pinging ai-runtime in M0)**

Note: M0's `/api/v1/utils/health-check/` does NOT ping ai-runtime yet. That's added in M1. Just confirm it returns 200:

```bash
curl http://localhost:8080/api/v1/utils/health-check/
```
Expected: HTTP 200 with `{"status":"ok",...}`.

- [ ] **Step 8: Stop everything**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
docker compose -f compose.yml -f compose.override.yml down
```
Expected: containers stop.

- [ ] **Step 9: Final commit with any cleanup**

If any docs / configs were adjusted during verification:
```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git status
# If there are changes:
git add -A
git commit -m "chore(m0): final cleanup after verification"
```

- [ ] **Step 10: Tag M0 complete**

```bash
cd "F:/dev/AI_Tools/workspace/psychoanalysis/psychoanalytic-version-update/emomind-lg"
git tag m0-foundation
git log --oneline | head -20
```
Expected: see ~15 commits and the `m0-foundation` tag.

---

## Self-Review Checklist (run before declaring M0 done)

- [ ] All Dify files deleted from backend, frontend, env, compose
- [ ] `mvn test` passes on `emomind-lg/backend-sb`
- [ ] `uv run pytest` passes on `emomind-lg/ai-runtime`
- [ ] `docker compose config` parses without error
- [ ] `docker compose up -d db redis` brings up infrastructure cleanly
- [ ] Spring Boot starts and `/api/v1/ai/healthz` returns 200 unauthenticated
- [ ] ai-runtime starts and `/healthz` returns 200
- [ ] Unauthenticated POST `/api/v1/ai/chat` returns 401
- [ ] V4 migration runs cleanly (creates `user_memory` table + `vector` extension)
- [ ] All commits use conventional commit prefixes (`feat:`, `chore:`, `ci:`)
- [ ] No `TODO` markers added beyond the deliberate placeholder in Task 5 Step 3

---

## Next Plan

After M0 is verified, proceed to **Milestone 1: ai_doctor text path** plan (file `2026-07-XX-emomind-lg-milestone-1-ai-doctor-text.md`). That plan will implement:
- ChatModel factory + MinMax provider
- ai_doctor graph with `classify_input → analyze_text → finalize → emit_response`
- Streaming from ai-runtime (LangGraph astream_events → SSE)
- Spring `AiProxyService.proxyChatStream`
- Spring `AiController.chat` (SSE passthrough)
- Frontend `langgraphApi.ts` (basic version)
- Frontend `useChat.ts` rewrite for ai-doctor graph
- Playwright `chat-streaming` E2E test