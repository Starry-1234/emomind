# 07 · Prompt 抽取与迁移指南

## 1. 目标

从 `emomind-sb/dify_workflow/` 下的两个 YAML 文件中，抽取所有 prompt 模板，迁移到 ai-runtime 的 `app/prompts/` 目录，以 LangGraph 节点的方式使用。

## 2. 抽取方法

### 2.1 YAML 结构定位

Dify 工作流 YAML 中，prompt 模板通常位于以下位置：

```yaml
- data:
    title: 引导性对话助手
    type: llm
    prompt_template:
      - id: guide-chat-system-prompt
        role: system
        text: |
          你是小心...
      - id: guide-chat-user-prompt
        role: user
        text: |
          用户问题：{{sys.query}}
```

### 2.2 字段含义

| 字段 | 含义 |
|------|------|
| `id` | prompt 唯一标识 |
| `role` | `system` / `user` / `assistant` |
| `text` | prompt 文本（可能含 `{{variable}}` 占位符）|
| `edition_type` | `basic` / `jinja2` 等 |

### 2.3 抽取脚本（实施时使用）

```python
# scripts/extract_dify_prompts.py
import yaml
from pathlib import Path

WORKFLOW_DIR = Path("../../emomind-sb/dify_workflow")
OUTPUT_DIR = Path("../app/prompts")

def extract_prompts(yml_path: Path, output_subdir: str):
    data = yaml.safe_load(yml_path.read_text(encoding="utf-8"))
    nodes = data["workflow"]["graph"]["nodes"]
    out_dir = OUTPUT_DIR / output_subdir
    out_dir.mkdir(parents=True, exist_ok=True)

    for node in nodes:
        if node.get("data", {}).get("type") != "llm":
            continue
        title = node["data"].get("title", "unknown")
        prompt_template = node["data"].get("prompt_template", [])

        for prompt in prompt_template:
            role = prompt.get("role", "user")
            text = prompt.get("text", "")
            prompt_id = prompt.get("id", f"{title}-{role}")
            edition = prompt.get("edition_type", "basic")

            # 文件名规范：{node_title}__{role}.j2
            safe_title = title.strip().replace(" ", "_").replace("/", "_")
            ext = ".j2" if edition == "jinja2" else ".md"
            out_path = out_dir / f"{safe_title}__{role}{ext}"
            out_path.write_text(text, encoding="utf-8")
            print(f"Extracted: {out_path}")

if __name__ == "__main__":
    extract_prompts(WORKFLOW_DIR / "智能心理医生_v0.2.yml", "ai_doctor")
    extract_prompts(WORKFLOW_DIR / "智能心理测评_v0.1.yml", "psych_test")
```

### 2.4 输出位置

```
ai-runtime/
└── app/
    └── prompts/
        ├── ai_doctor/
        │   ├── 用户输入__user.md          （如需要）
        │   ├── 文档分析__system.md
        │   ├── 文档分析__user.md
        │   ├── 纯文本分析__system.md
        │   ├── 纯文本分析__user.md
        │   ├── 视频分析输出__system.md
        │   ├── 视频分析输出__user.md
        │   ├── 音频分析输出__system.md
        │   ├── 音频分析输出__user.md
        │   ├── 融合分析输出__system.md
        │   ├── 融合分析输出__user.md
        │   ├── 融合回复__system.md
        │   └── 融合回复__user.md
        └── psych_test/
            ├── 意图分析__system.md
            ├── 意图分析__user.md
            ├── 引导性对话助手__system.md
            ├── 引导性对话助手__user.md
            ├── 测试题生成__system.md
            ├── 测试题生成__user.md
            ├── 情感测试题分析__system.md
            ├── 情感测试题分析__user.md
            ├── 报告生成__system.md
            └── 报告生成__user.md
```

## 3. 占位符转换

### 3.1 Dify 变量语法

Dify 用 `{{sys.variable_name}}` 或 `{{#variable_name#}}` 引用变量。

### 3.2 LangGraph / Jinja2 语法

迁移时统一用 Jinja2：

```jinja2
{# 原 Dify: {{sys.query}} #}
用户问题：{{ query }}

{# 原 Dify: {{#conversation.history#}} #}
历史对话：
{% for msg in history %}
  {{ msg.role }}: {{ msg.content }}
{% endfor %}
```

### 3.3 变量命名规范

迁移时统一为 snake_case：

| Dify | LangGraph |
|------|-----------|
| `sys.query` | `query` |
| `sys.conversation_id` | `conversation_id` |
| `sys.user_id` | `user_id` |
| `sys.files` | `files` |
| `sys.files[0].url` | `files[0].url` |

## 4. Prompt 加载工具

```python
# app/prompts/loader.py
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

_PROMPTS_DIR = Path(__file__).parent
_env = Environment(
    loader=FileSystemLoader(str(_PROMPTS_DIR)),
    trim_blocks=True,
    lstrip_blocks=True,
)

_cache: dict[str, str] = {}

def get_prompt(category: str, name: str) -> str:
    """
    category: "ai_doctor" | "psych_test"
    name: e.g. "纯文本分析__system"
    """
    key = f"{category}/{name}"
    if key not in _cache:
        template = _env.get_template(f"{category}/{name}.md")
        _cache[key] = template.render()
    return _cache[key]

def render_prompt(category: str, name: str, **vars) -> str:
    """Render with variables."""
    template = _env.get_template(f"{category}/{name}.md")
    return template.render(**vars)
```

## 5. 在节点中使用

```python
# app/graphs/nodes/analyze_text.py
from app.prompts.loader import render_prompt
from app.models.factory import get_chat_model
from langchain_core.messages import HumanMessage, SystemMessage

async def analyze_text(state: GraphState) -> dict:
    messages = state["messages"]
    user_query = messages[-1].content if messages else ""

    system_prompt = render_prompt(
        "ai_doctor", "纯文本分析__system",
        user_id=state.get("user_id"),
    )
    user_prompt = render_prompt(
        "ai_doctor", "纯文本分析__user",
        query=user_query,
        long_term_memory=state.get("long_term_memory", []),
    )

    model = get_chat_model("minimax")
    response = await model.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])

    return {"analyses": {**state.get("analyses", {}), "text": response.content}}
```

## 6. 新增 prompt（LangGraph 特有）

迁移时还会新增以下 prompt（Dify 工作流中没有）：

### 6.1 extract_facts

```
prompt: psych_test/extract_facts__system
prompt: psych_test/extract_facts__user

用途：从对话历史抽取用户级事实（用于长期记忆）
输入：最近 N 条消息
输出：JSON 数组 [{fact, category, importance}]
```

### 6.2 intent_classifier

```
prompt: psych_test/intent_classifier__system
prompt: psych_test/intent_classifier__user

用途：把用户输入分类为 ask_howto / start_test / answer / chitchat
输入：当前用户消息 + 最近对话
输出：enum 字符串
```

### 6.3 classify_input（ai_doctor）

```
prompt: ai_doctor/classify_input__system
prompt: ai_doctor/classify_input__user

用途：判断输入模态（text / audio / video / image / doc / multimodal）
输入：user query + files metadata
输出：modality 字符串
```

### 6.4 analyze_answer（psych_test）

```
prompt: psych_test/analyze_answer__system
prompt: psych_test/analyze_answer__user

用途：评分 + 情感标签提取
输入：用户答案 + 题目内容
输出：JSON {"score": int, "analysis": str, "emotion_tags": [str]}
```

### 6.5 generate_report

```
prompt: psych_test/generate_report__system
prompt: psych_test/generate_report__user

用途：综合所有答案生成最终测评报告
输入：所有题目、答案、分数、情感标签
输出：报告文本
```

## 7. Prompt 调优流程

实施 M3 / M5 时：

1. **从 Dify YAML 抽取 → 保存到 prompts/ 目录**
2. **替换占位符语法（{{sys.x}} → {{ x }}）**
3. **加 long_term_memory 注入点**
4. **用 LLM 快照测试验证输出不漂移**
5. **若输出差异大 → 调优 prompt 措辞**
6. **提交 prompt 改动 + 快照更新**

## 8. 安全与合规

所有 prompt 必须包含：

- **角色边界**："你是 AI 心理助手，不能替代专业医生"
- **危机干预**：检测到自杀/自伤倾向时引导用户联系专业机构
- **隐私保护**：不询问/存储用户真实姓名、联系方式
- **拒绝内容**：不回应色情、暴力、政治敏感话题

这些安全 prompt 应放在 system prompt 的固定部分，独立于业务逻辑。