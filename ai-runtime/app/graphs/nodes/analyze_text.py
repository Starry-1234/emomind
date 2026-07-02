"""M1 text analysis node.

Calls MinMax via the model factory, with prompt rendered from Jinja2.
The state is expected to have at least one user message. Returns
{"analyses": {"text": "<reply>"}}.
"""
from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

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