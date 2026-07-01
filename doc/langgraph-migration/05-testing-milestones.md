# 05 · 测试策略与里程碑

## 1. 测试层级总览

| 层级 | 工具 | 覆盖目标 | 何时跑 |
|------|------|---------|--------|
| **Unit (Python)** | pytest + LangGraph node API | 单个节点函数、prompt 模板渲染 | `pytest tests/unit/`，每个 PR |
| **Integration (Python)** | pytest + testcontainers | 整个 graph 跑通；checkpointer 真实写入 | `pytest tests/integration/`，每个 PR |
| **Contract (Python)** | pydantic + 自定义校验 | API 请求/响应 schema | `pytest tests/contract/`，每个 PR |
| **LLM 行为快照** | pytest + 真实 LLM（带 budget cap）| 关键 prompt 输出稳定性 | 手动触发；M3/M6 必跑 |
| **Unit (Java)** | JUnit 5 + Mockito（沿用）| AiProxyService 各方法、ConversationMetaService、LangGraphProperties | `mvn test`，每个 PR |
| **Integration (Java)** | Spring Boot Test + MockWebServer | AiController 端到端、SSE 透传、鉴权 | `mvn verify`，每个 PR |
| **E2E (前端)** | Playwright（沿用）| 用户完整流程 | `bun run test`，M1+ 每个 milestone |
| **契约测试（前后端）**| OpenAPI schema 双向校验 | ai-runtime pydantic 导出 OpenAPI；Spring springdoc 反向校验 | CI |

## 2. Python 测试约定

### 2.1 目录结构

```
ai-runtime/
├── tests/
│   ├── conftest.py                    全局 fixtures（testcontainers pg/redis、test_user、test_thread）
│   ├── unit/
│   │   ├── test_classify_input.py
│   │   ├── test_analyze_text.py
│   │   ├── test_analyze_audio.py
│   │   ├── test_intent_classifier.py
│   │   ├── test_analyze_answer.py
│   │   ├── test_extract_facts.py
│   │   ├── test_load_memory.py
│   │   ├── test_user_memory_store.py
│   │   ├── test_redis_cache.py
│   │   └── test_streaming.py
│   ├── integration/
│   │   ├── test_ai_doctor_graph.py
│   │   ├── test_psych_test_graph.py
│   │   ├── test_checkpoint_resume.py
│   │   ├── test_stop_mechanism.py
│   │   ├── test_long_term_memory_persistence.py
│   │   ├── test_file_upload_flow.py
│   │   └── test_admin_view_other_user.py
│   ├── contract/
│   │   ├── test_api_schema.py
│   │   └── test_sse_event_format.py
│   ├── llm_snapshot/
│   │   ├── conftest.py                真实 LLM fixture（带 token budget 限制）
│   │   ├── test_ai_doctor_text_snapshots.py
│   │   ├── test_ai_doctor_multimodal_snapshots.py
│   │   └── test_psych_test_snapshots.py
│   └── utils/
│       ├── llm_mock.py                mock ChatModel
│       └── helpers.py
```

### 2.2 关键测试用例

#### Unit

**`test_classify_input.py`**
- 输入纯文本 → state["modality"] = "text"
- 输入单张图片 → state["modality"] = "image"
- 输入多个文件（image + doc）→ state["modality"] = "multimodal"
- 输入空 input → 抛 ValueError

**`test_analyze_text.py`**
- 正常文本输入 → 调 MinMax → 返回分析结果
- LLM 抛 BadRequestError → 不重试，直接抛
- LLM 抛 RateLimitError → 重试 2 次后抛

**`test_intent_classifier.py`**
- "我该怎么做" → "ask_howto"
- "开始测试吧" → "start_test"
- "我最近总是失眠" → "answer"
- "你好" → "chitchat"

**`test_extract_facts.py`**
- 包含工作焦虑的对话 → 抽取 fact 包含 "工作" + category "stress"
- 闲聊 → 抽取 fact 为空列表
- LLM 输出非 JSON → 抛 + 记录到 log

#### Integration

**`test_ai_doctor_graph.py`**
- `test_text_only_path`: 纯文本 → 走 `analyze_text` → emit_response → checkpoint 写入
- `test_image_path`: 附图 → 走 `analyze_image` → emit_response
- `test_audio_path`: 附音频 → 走 `analyze_audio` → emit_response
- `test_multimodal_path`: 多文件 → 走 `fusion_analyze` → emit_response
- `test_long_term_memory_written`: 跑完一轮后 user_memory 表有新增记录
- `test_message_end_event_format`: emit_response 输出符合 SSE 协议

**`test_psych_test_graph.py`**
- `test_intent_routing_ask_howto`: 输入"怎么做" → 命中 guide_assistant → emit_response
- `test_intent_routing_start_test`: 输入"开始吧" → 命中 generate_first_question
- `test_progress_state`: 跑 5 轮回答后 test_progress.current=5, phase="testing"
- `test_complete_to_report`: 跑满 N 题 → generate_report → persist_test_record 被 mock 调
- `test_clarify_path`: 模糊答案 → clarify_answer → emit_response

**`test_checkpoint_resume.py`**
- `test_resume_after_kill`: 跑 graph 到一半，模拟进程 kill，重启后同 thread_id 继续 → state 正确恢复
- `test_resume_from_offset`: thread 已有 3 条消息，新一轮 user 输入 → 从第 4 条开始

**`test_stop_mechanism.py`**
- `test_user_stop`: 发起 chat → 2s 后调 stop → SSE 断开 + checkpoint 未污染
- `test_timeout_stop`: 设置 1s 超时 → SSE event=error code=LLM_TIMEOUT

#### LLM 快照

```python
# tests/llm_snapshot/test_ai_doctor_text_snapshots.py
import pytest

@pytest.mark.snapshot
@pytest.mark.uses_real_llm
async def test_text_response_contains_empathy(snapshot):
    state = {"messages": [HumanMessage(content="我最近很难入睡")]}
    result = await analyze_text_node(state, llm=get_real_llm("minimax"))
    snapshot.assert_match(result["analysis_result"])
```

快照文件 `tests/llm_snapshot/snapshots/` 用 git 管理。每次 PR 改动 prompt 需主动更新快照。

### 2.3 testcontainers fixtures

```python
# conftest.py
import pytest
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

@pytest.fixture(scope="session")
def pg_container():
    with PostgresContainer("postgres:17") as pg:
        # 安装 pgvector 扩展
        yield pg

@pytest.fixture(scope="session")
def redis_container():
    with RedisContainer("redis:7") as r:
        yield r

@pytest.fixture
async def checkpointer(pg_container):
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    cp = AsyncPostgresSaver.from_conn_string(pg_container.get_connection_url())
    await cp.setup()
    return cp

@pytest.fixture
async def memory_store(pg_container):
    return UserMemoryStore(pg_container.get_connection_url())

@pytest.fixture
async def redis_client(redis_container):
    import redis.asyncio as redis
    return redis.from_url(redis_container.get_connection_url())
```

## 3. Java 测试约定

### 3.1 沿用现有

`backend-sb/src/test/java/com/emomind/` 沿用现有结构。新增：

```
src/test/java/com/emomind/
├── controller/
│   └── AiControllerTest.java               新
├── service/
│   ├── AiProxyServiceTest.java             新
│   ├── ConversationMetaServiceTest.java    新
│   └── UserMemoryServiceTest.java          新（如有 service 层）
├── entity/
│   └── ConversationMetaTest.java           新（如果有约束校验）
├── security/
│   └── AiEndpointAuthorizationTest.java    新
└── migration/
    ├── V4PgvectorMigrationTest.java        新
    └── V5ConversationMetaMigrationTest.java 新
```

### 3.2 关键测试

**`AiProxyServiceTest.java`**

```java
@ExtendWith(MockitoExtension.class)
class AiProxyServiceTest {
    @Mock WebClient webClient;

    @Test
    void proxyChatStream_injectsRequiredHeaders() {
        // 验证 X-User-Id / X-User-Roles / X-Internal-Token / X-Trace-Id 都注入
        // 用 MockWebServer 接收并断言
    }

    @Test
    void proxyChatStream_passesThroughSSEBytes() {
        // 验证 SSE 字节流不解析、不改写、原样转发
    }

    @Test
    void proxyStop_returns200OnSuccess() {
        // mock 200 → 返回 Mono.empty()
    }
}
```

**`AiControllerAuthTest.java`**

```java
@SpringBootTest
@AutoConfigureMockMvc
class AiControllerAuthTest {
    @Autowired MockMvc mvc;

    @Test
    void unauthenticated_chat_returns401() throws Exception {
        mvc.perform(post("/api/v1/ai/chat")).andExpect(status().isUnauthorized());
    }

    @Test
    void nonAdmin_listConversationsWithTargetUserId_returns403() throws Exception {
        // 普通用户带 ?user_id= 参数应被拒绝
    }
}
```

**`V4PgvectorMigrationTest.java`**

```java
@SpringBootTest
@Testcontainers
class V4PgvectorMigrationTest {
    @Container static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:17")
        .withInitScript("init-pgvector.sql");

    @Test
    void pgvectorExtensionExists() {
        // 验证 CREATE EXTENSION vector 成功
    }

    @Test
    void userMemoryTableCreated() {
        // 验证表结构、embedding 列类型为 vector
    }
}
```

## 4. 前端 E2E 测试

### 4.1 沿用现有 + 新增

```
frontend/tests/
├── auth.setup.ts                      沿用
├── chat-streaming.spec.ts             新（替换现有 dify 版本）
├── chat-stop.spec.ts                  新
├── chat-regenerate-versions.spec.ts   新
├── chat-pause-resume.spec.ts          新
├── chat-file-upload.spec.ts           新
├── chat-multimodal.spec.ts            新（多模态）
├── test-complete-flow.spec.ts         新
├── test-intent-routing.spec.ts        新
├── admin-view-conversations.spec.ts   新
├── config.ts                          沿用
├── utils/                             沿用
└── ...（保留现有 spec.ts）
```

### 4.2 关键用例

**`chat-streaming.spec.ts`**
```typescript
test("send text message → token stream appears → complete", async ({ page }) => {
  await loginAsUser(page)
  await page.goto("/user/ai-doctor/chat")
  await page.fill('[data-testid=chat-input]', "我最近很难入睡")
  await page.click('[data-testid=send-btn]')
  
  // 等待首 token 出现
  await expect(page.locator('[data-testid=assistant-message]')).toBeVisible({ timeout: 10000 })
  
  // 验证消息持续增长
  const content1 = await page.locator('[data-testid=assistant-message]').textContent()
  await page.waitForTimeout(2000)
  const content2 = await page.locator('[data-testid=assistant-message]').textContent()
  expect(content2!.length).toBeGreaterThan(content1!.length)
  
  // 等待 message_end
  await expect(page.locator('[data-testid=streaming-indicator]')).toBeHidden({ timeout: 30000 })
})
```

**`chat-regenerate-versions.spec.ts`**
```typescript
test("regenerate twice → can switch between 3 versions", async ({ page }) => {
  // ... 发送消息 → 收到响应 → 点重新生成 → 再收到 → 再点重新生成
  // 验证版本切换按钮出现，切换版本内容正确
})
```

**`chat-multimodal.spec.ts`**
```typescript
test("upload image + send → response references image", async ({ page }) => {
  await page.setInputFiles('[data-testid=file-input]', 'fixtures/test-image.jpg')
  await page.fill('[data-testid=chat-input]', "看这张图片")
  await page.click('[data-testid=send-btn]')
  
  // 验证响应提及图片分析
  await expect(page.locator('[data-testid=assistant-message]')).toContainText(/图片|图像|照片/, { timeout: 30000 })
})
```

## 5. 契约测试

### 5.1 ai-runtime → Spring

ai-runtime 用 pydantic 定义所有请求/响应模型，启动时导出 OpenAPI：

```python
# scripts/export_openapi.py
from app.main import app
import json

with open("openapi.json", "w") as f:
    json.dump(app.openapi(), f)
```

Spring 端用 springdoc 反向校验（mock server 模式）：

```java
@SpringBootTest
class AiRuntimeContractTest {
    @Test
    void backendExpects_matchAiRuntimeSchema() throws Exception {
        // 加载 ai-runtime 的 openapi.json
        // 验证 Spring 的 WebClient 调用代码与 schema 一致
    }
}
```

### 5.2 Spring → Frontend

沿用现有 OpenAPI → TS 客户端生成流程。新增 `chat-controller` 在 OpenAPI 中暴露。

## 6. 里程碑详细计划

### M0: 项目骨架（1 周）

**任务清单**
- [ ] 复制 `emomind-sb/` → `emomind-lg/` 目录
- [ ] 删除 `dify_workflow/`、`backend-sb/src/main/java/com/emomind/controller/DifyController.java`、`backend-sb/src/main/java/com/emomind/service/DifyService.java`、`backend-sb/src/main/java/com/emomind/config/DifyProperties.java`
- [ ] 删除 `frontend/src/services/difyApi.ts`
- [ ] 删除 `application.yml` 中 `app.dify.*`
- [ ] 删除 `.env.example` 中 `DIFY_*`
- [ ] 新建 `ai-runtime/` 空壳（main.py + FastAPI hello world）
- [ ] 修改 `compose.yml`：移除 Dify 服务（如果有），加 redis 服务，加 ai-runtime 服务
- [ ] 加 `ai-runtime/Dockerfile`
- [ ] 加 `pgvector` 扩展到 `db` 服务的 init 脚本
- [ ] 加 `LangGraphProperties`、`AiProxyService`、`AiController` 空壳（路由存在但返回 501）
- [ ] 加 V4 Flyway 迁移（pgvector + user_memory 占位）
- [ ] CI 配置：加 `pytest` 任务

**验收**
- `mvn test` 全绿
- `pytest` 全绿（哪怕只有 hello world）
- `docker compose up` 起得来
- README.md 更新

### M1: ai_doctor 文本路径（1 周）

**任务清单**
- [ ] 实现 `models/factory.py` + `models/minimax.py`
- [ ] 实现 `graphs/state.py`
- [ ] 实现 `graphs/ai_doctor.py` 文本路径（classify_input → analyze_text → finalize → emit_response）
- [ ] 实现 `streaming.py`（astream_events → SSE 帧）
- [ ] 实现 `auth.py`（X-Internal-Token 校验）
- [ ] 实现 `AiController.chat` + `AiProxyService.proxyChatStream`
- [ ] 实现前端 `langgraphApi.ts`（基础版本）
- [ ] 实现前端 `useChat.ts`（基础版本：流式 + stop + send）
- [ ] 集成测试：`test_ai_doctor_text_only_path`

**验收**
- `curl POST /api/v1/ai/chat` 能拿到完整 SSE 流
- Playwright `chat-streaming` 通过
- 端到端：登录 → 发送文本 → 收到回复

### M2: ai_doctor 多模态（1 周）

**任务清单**
- [ ] 实现 `models/qwen_omni.py`
- [ ] 实现 `analyze_audio`、`analyze_video`、`extract_doc`、`analyze_doc`、`fusion_analyze` 节点
- [ ] 扩展 `classify_input` 路由逻辑
- [ ] 实现 `AiController.files.upload` + `AiController.files.get`
- [ ] 实现 ai-runtime `api/files.py`
- [ ] 前端文件附件 UI 接入
- [ ] 实现 `extract_facts` + `write_long_term`（先不接 pgvector，用内存 mock）
- [ ] 集成测试：图片 / 音频 / 视频 / 文档各路径

**验收**
- Playwright `chat-multimodal` 通过
- 文件上传 → chat → 收到基于文件内容的响应

### M3: psych_test（2 周）

**任务清单**
- [ ] 抽取 Dify YAML 中的 prompt 到 `app/prompts/psych_test/`
- [ ] 实现 `intent_classifier` 节点
- [ ] 实现 `guide_assistant` 节点（含知识检索）
- [ ] 实现 `generate_first_question` / `generate_next_question`
- [ ] 实现 `analyze_answer`（评分 + 情感标签）
- [ ] 实现 `update_progress` + `route_after_answer`
- [ ] 实现 `generate_report`
- [ ] 实现 `persist_test_record`（调 Spring 内部 API）
- [ ] 前端 `/user/test` 切换到 langgraphApi
- [ ] 配置测评题目模板（JSON / DB）
- [ ] 集成测试：`test_psych_test_graph`

**验收**
- Playwright `test-complete-flow` 通过
- 用户能走完：引导 → Q&A × N → 报告
- TestRecord 表有新记录

### M4: 持久化 + 长期记忆（1 周）

**任务清单**
- [ ] 完善 V4 Flyway：user_memory 表 + 索引（hnsw）
- [ ] 加 V5 Flyway：conversation_meta 表
- [ ] 实现 `memory/checkpointer.py`（PostgresSaver 单例）
- [ ] 实现 `memory/long_term.py`（pgvector 读写）
- [ ] 实现 `memory/cache.py`（Redis 客户端）
- [ ] 接 `extract_facts` 到 pgvector
- [ ] 实现 `load_memory` 节点（新会话时注入）
- [ ] 实现 `ConversationMeta` JPA 实体 + Service + Repository
- [ ] 实现 Spring `AiController` 的 conversations/messages/delete 接口
- [ ] 实现 ai-runtime `api/conversations.py` + `api/messages.py`
- [ ] 集成测试：`test_checkpoint_resume` + `test_long_term_memory_persistence`

**验收**
- 跨进程重启：thread 续聊能恢复
- 新会话开始时注入 top-5 相关长期记忆
- 管理员能查看任意用户的会话列表

### M5: 高级交互（1 周）

**任务清单**
- [ ] 实现 stop 机制（Redis cancel 标志）
- [ ] 实现重新生成多版本
- [ ] 实现暂停+继续生成（基于 checkpoint resume）
- [ ] 实现 sessionStorage 缓存
- [ ] 实现多标签页 pub/sub 同步
- [ ] 实现自动重连
- [ ] 完善 useChat 全部状态机
- [ ] 集成测试：`test_stop_mechanism` + Playwright `chat-regenerate-versions` + `chat-pause-resume`

**验收**
- 所有现有用户交互能力 1:1 平迁
- Playwright 全套 spec 通过

### M6: 切流量 + 收尾（1 周）

**任务清单**
- [ ] DifyController/DifyService 完全删除（代码 + 配置 + 文档）
- [ ] Dify 相关 Dockerfile / compose 服务移除
- [ ] README.md 重写（Dify 章节替换为 ai-runtime 章节）
- [ ] 监控告警配置（Prometheus rules）
- [ ] 性能 baseline 测试（p50/p95 latency）
- [ ] 文档审查（README + doc/langgraph-migration/）
- [ ] Playwright E2E 全绿
- [ ] 灰度切流量（按用户 ID 1% → 10% → 100%）
- [ ] 旧分支 `emomind-sb` 标记为 archived

**验收**
- 生产环境 Dify 容器不再部署
- 监控面板显示所有新指标
- 用户无感切换

## 7. CI/CD

### 7.1 CI Pipeline（GitHub Actions）

```yaml
name: CI
on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '17' }
      - name: Test backend
        run: cd backend-sb && mvn verify

  ai-runtime:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg17
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
      redis:
        image: redis:7
        ports: ['6379:6379']
        options: --health-cmd "redis-cli ping"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - name: Install uv
        run: pip install uv
      - name: Install deps
        run: cd ai-runtime && uv sync
      - name: Lint
        run: cd ai-runtime && uv run ruff check
      - name: Type check
        run: cd ai-runtime && uv run mypy app/
      - name: Test
        run: cd ai-runtime && uv run pytest tests/unit tests/integration tests/contract -v
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/postgres
          REDIS_URL: redis://localhost:6379

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - name: Install
        run: cd frontend && bun install
      - name: Lint
        run: cd frontend && bun run lint
      - name: Build
        run: cd frontend && bun run build
      - name: E2E (against preview server)
        run: |
          cd frontend
          bun run build
          bun run preview &
          bunx playwright test
```

### 7.2 部署（生产）

详见 [12-deployment.md](12-deployment.md)。

## 8. 验收检查表（每个 Milestone 必过）

- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 所有 E2E 测试通过
- [ ] Lint 零 warning
- [ ] Type check 零 error
- [ ] 文档更新
- [ ] 无新增 `TODO` / `FIXME`
- [ ] 无未跟踪的依赖
- [ ] 性能 baseline 与上 milestone 持平或更好
- [ ] 安全扫描无高危漏洞（trivy / snyk）