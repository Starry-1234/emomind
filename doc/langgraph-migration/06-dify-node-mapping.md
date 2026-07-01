# 06 · Dify 节点 → LangGraph 节点映射

> 本文档是实施期间的速查表：从 Dify YAML 中识别节点，映射到 LangGraph 中的对应实现。

## 1. 智能心理医生（`dify_workflow/智能心理医生_v0.2.yml`）

### 1.1 节点清单（Dify YAML 实际节点）

| Dify 节点 | 节点 ID | 类型 | 输入 | 输出 |
|-----------|---------|------|------|------|
| 用户输入 | 1778421740102 | `start` | user query + files | start event |
| 是否有视频 | (cond) | `if-else` | files metadata | route |
| 是否有音频 | (cond) | `if-else` | files metadata | route |
| 是否有文档 | (cond) | `if-else` | files metadata | route |
| 文档提取器 | 1778491689976 | `document-extractor` | files | extracted text |
| 文档分析 | 1778491711834 | `llm` | extracted text | analysis result |
| 纯文本分析 | 1778743552862 | `llm` | query | analysis result |
| 视频分析输出 | (LLM via 视频/音频分类节点) | `llm` | video frames | analysis result |
| 音频分析输出 | (LLM via 视频/音频分类节点) | `llm` | audio transcript | analysis result |
| 融合分析输出 | (final LLM) | `llm` | all analyses | fused analysis |
| 融合回复 | 1779355725826 | `llm` | fused analysis | user-facing reply |
| 多模态输出聚合 | 1778421802489 | `answer` | reply | final answer event |

### 1.2 映射到 LangGraph

| Dify 节点 | LangGraph 节点 | 文件 | 输入 | 输出 | 备注 |
|-----------|----------------|------|------|------|------|
| 用户输入 | (graph START) | — | user input | state.messages | LangGraph 的 StateGraph 入口 |
| 是否有视频/音频/文档 | `classify_input` | `app/graphs/nodes/classify_input.py` | state.files + state.messages | state.modality | 路由决策；LLM 辅助判断模态组合 |
| 文档提取器 | `extract_doc` | `app/graphs/nodes/extract_doc.py` | state.files (doc) | state.doc_text | 用 pypdf / python-docx / unstructured |
| 文档分析 | `analyze_doc` | `app/graphs/nodes/analyze_doc.py` | state.doc_text + state.messages | state.analyses["doc"] | LLM MinMax |
| 纯文本分析 | `analyze_text` | `app/graphs/nodes/analyze_text.py` | state.messages | state.analyses["text"] | LLM MinMax |
| 视频分析输出 | `analyze_video` | `app/graphs/nodes/analyze_video.py` | state.files (video) + state.messages | state.analyses["video"] | LLM Qwen3-Omni（多模态） |
| 音频分析输出 | `analyze_audio` | `app/graphs/nodes/analyze_audio.py` | state.files (audio) + state.messages | state.analyses["audio"] | LLM Qwen3-Omni |
| 融合分析输出 | `fusion_analyze` | `app/graphs/nodes/fusion_analyze.py` | state.analyses (all) | state.fused | LLM Qwen3-Omni |
| 融合回复 | `finalize` | `app/graphs/nodes/finalize.py` | state.fused + state.messages | state.analyses["final"] | 格式化、脱敏、长度检查 |
| 多模态输出聚合 | `emit_response` | `app/graphs/nodes/emit_response.py` | state.analyses["final"] | SSE event=message_end | 写 SSE + checkpoint |

### 1.3 LangGraph 路由

```python
# app/graphs/ai_doctor.py
def route_by_modality(state: GraphState) -> str:
    files = state.get("files") or []
    mimes = {f.get("mime", "").split("/")[0] for f in files}
    has_doc = any(f.get("mime") == "application/pdf" or f.get("name", "").endswith((".pdf", ".docx", ".txt")) for f in files)
    has_image = "image" in mimes
    has_audio = "audio" in mimes
    has_video = "video" in mimes

    if has_audio or has_video or has_image or has_doc:
        if len([x for x in (has_audio, has_video, has_image, has_doc) if x]) > 1:
            return "multimodal"
        if has_audio: return "audio"
        if has_video: return "video"
        if has_image: return "image"
        if has_doc: return "doc"
    return "text"
```

### 1.4 边（edges）

```
START → load_memory → classify_input
classify_input → analyze_text / analyze_audio / analyze_video / extract_doc / fusion_analyze
extract_doc → analyze_doc
analyze_text / analyze_audio / analyze_video / analyze_doc / fusion_analyze → finalize
finalize → emit_response
emit_response → extract_facts
extract_facts → write_long_term
write_long_term → END
```

## 2. 智能心理测评（`dify_workflow/智能心理测评_v0.1.yml`）

### 2.1 节点清单（Dify YAML 实际节点）

| Dify 节点 | 节点 ID | 类型 | 输入 | 输出 |
|-----------|---------|------|------|------|
| 用户输入 | (start) | `start` | user query | start event |
| 意图分析 | (LLM) | `llm` | messages | intent enum |
| 知识检索 | (knowledge-retrieval) | `knowledge-retrieval` | query | retrieved docs |
| 引导性对话助手 | (LLM with retrieval context) | `llm` | query + retrieved | guide reply |
| 引导回复 | (answer) | `answer` | guide reply | answer event |
| 测试题生成 | (LLM) | `llm` | test template + history | question |
| 测试题输出 | (answer) | `answer` | question | answer event |
| 情感测试题分析 | (LLM) | `llm` | answer | score + analysis |
| 情感标签生成器 | (LLM) | `llm` | answer | emotion tags |
| 提取情感标签 | (LLM) | `llm` | tags | extracted tags |
| 测试题分析输出 | (answer) | `answer` | analysis | answer event |
| 情感标签输出 | (answer) | `answer` | tags | answer event |

### 2.2 映射到 LangGraph

| Dify 节点 | LangGraph 节点 | 文件 | 输入 | 输出 | 备注 |
|-----------|----------------|------|------|------|------|
| 用户输入 | (graph START) | — | user input | state.messages | |
| 意图分析 | `intent_classifier` | `app/graphs/nodes/intent_classifier.py` | state.messages | state.intent (enum) | LLM 输出 enum |
| 知识检索 | （内嵌于 `guide_assistant`） | — | query | retrieved docs | 用 langchain retriever |
| 引导性对话助手 | `guide_assistant` | `app/graphs/nodes/guide_assistant.py` | state.messages + retrieved | state.assistant_reply | LLM MinMax |
| 引导回复 | `emit_response` | `app/graphs/nodes/emit_response.py` | state.assistant_reply | SSE event | 复用 ai_doctor 的 emit_response |
| 测试题生成（首次） | `generate_first_question` | `app/graphs/nodes/generate_question.py` | test template + state.messages | state.pending_question | LLM MinMax |
| 测试题生成（后续） | `generate_next_question` | `app/graphs/nodes/generate_question.py` | test template + state.test_progress | state.pending_question | 同上，根据 progress 生成下一题 |
| 测试题输出 | `emit_response` | 同上 | state.pending_question | SSE event | |
| 情感测试题分析 | `analyze_answer` | `app/graphs/nodes/analyze_answer.py` | state.pending_question + state.messages | state.answer_analysis | LLM MinMax |
| 情感标签生成器 + 提取情感标签 | （合并入 `analyze_answer`） | 同上 | state.messages | state.emotion_tags | 一次 LLM 调用同时输出分数和标签 |
| 测试题分析输出 | `update_progress` + `emit_response` | `app/graphs/nodes/update_progress.py` | state.answer_analysis | state.test_progress + SSE event | 更新进度 + 推送 |
| 情感标签输出 | （合并）| — | state.emotion_tags | SSE event=workflow_event | 推送标签 |

### 2.3 LangGraph 路由

```python
# app/graphs/psych_test.py
def route_by_intent(state: GraphState) -> str:
    intent = state.get("intent")
    if intent in ("ask_howto", "chitchat"):
        return "guide"
    elif intent == "start_test":
        return "start_test"
    elif intent == "answer":
        return "answer"
    return "guide"  # 默认走引导

def route_after_answer(state: GraphState) -> str:
    progress = state.get("test_progress", {})
    if progress.get("current", 0) >= progress.get("total", 1):
        return "complete"
    if state.get("answer_ambiguous"):
        return "clarify"
    return "next_question"
```

### 2.4 边（edges）

```
START → load_test_template → load_memory → intent_classifier
intent_classifier → guide_assistant / generate_first_question / analyze_answer
guide_assistant → emit_response → END
generate_first_question → emit_response → END
analyze_answer → update_progress
update_progress → generate_next_question / clarify_answer / generate_report
generate_next_question → emit_response → END
clarify_answer → emit_response → END
generate_report → persist_test_record → emit_response → END
```

### 2.5 GraphState（psych_test 扩展）

```python
class PsychTestState(GraphState):
    intent: Optional[Literal["ask_howto", "start_test", "answer", "chitchat"]]
    phase: Optional[Literal["guide", "testing", "reporting"]]
    test_progress: Optional[dict]
    # test_progress 格式：
    # {
    #   "template_id": "phq-9",
    #   "current": 3,
    #   "total": 9,
    #   "scores": [2, 1, 3, ...],
    #   "answers": [{"question_id": "q1", "answer": "...", "score": 2}, ...]
    # }
    emotion_tags: Optional[list[str]]
    pending_question: Optional[dict]
    answer_ambiguous: Optional[bool]
    test_record_id: Optional[str]
```

## 3. prompt 抽取任务清单

实施 M3 时需要从 Dify YAML 抽取的 prompt：

### 3.1 智能心理医生

- [ ] 文档分析 prompt
- [ ] 纯文本分析 prompt
- [ ] 视频分析 prompt
- [ ] 音频分析 prompt
- [ ] 融合分析 prompt
- [ ] 融合回复 prompt（用户面向回复风格）
- [ ] 抽取事实 prompt（新增）
- [ ] 系统 prompt（含 role / 安全约束 / 中文回复风格）

### 3.2 智能心理测评

- [ ] 意图分析 prompt（输出 enum）
- [ ] 引导性对话助手 prompt（system + user template）
- [ ] 测试题生成 prompt（首次 / 后续）
- [ ] 情感测试题分析 prompt（评分 + 标签）
- [ ] 报告生成 prompt
- [ ] 系统 prompt

详细抽取方法见 [07-prompts.md](07-prompts.md)。

## 4. 关键差异点

### 4.1 Dify 节点特性 → LangGraph 等价物

| Dify 特性 | LangGraph 等价 |
|-----------|---------------|
| `start` 节点 | `StateGraph(START)` |
| `answer` 节点 | 终止节点 + SSE 发射 |
| `if-else` 路由 | `add_conditional_edges(from, route_fn, path_map)` |
| `llm` 节点 | 自定义 async 函数 + ChatModel |
| `knowledge-retrieval` | LangChain `Retriever`（嵌入到节点函数里）|
| `document-extractor` | Python 库（unstructured / pypdf）|
| `code` 节点 | Python 函数 |
| `template-transform` | Jinja2 字符串模板 |
| `parameter-extractor` | LLM function calling |
| `iteration` / `loop` | 子图（subgraph）|

### 4.2 LangGraph 优势（Dify 没有）

1. **类型安全的状态**：TypedDict 编译期检查
2. **持久化 checkpoint**：自动保存每个节点执行后的 state
3. **time-travel**：可回到任意历史 checkpoint
4. **子图组合**：复杂流程可拆分为可测试的子图
5. **可视化**：LangGraph Studio 调试
6. **Python 单测**：节点是普通函数，可 mock LLM 跑测试

### 4.3 LangGraph 学习成本

- 节点函数签名：`async def node(state: GraphState, config: RunnableConfig) -> dict`
- 状态合并：`Annotated[list, add_messages]`、`operator.add`
- checkpointer 配置：`graph.compile(checkpointer=...)`
- 流式 API：`astream_events(version="v2")`
- 配置传递：`config["configurable"]["thread_id"]`

参考 LangGraph 官方文档 https://langchain-ai.github.io/langgraph/。