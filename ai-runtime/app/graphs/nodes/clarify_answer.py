"""M3 clarify_answer: LLM asks user to clarify. Always-skipped via route_after_answer.

Implemented for completeness; M3 sets answer_ambiguous=False so this
node is never reached. Future M5 may add LLM-based ambiguity detection.
"""
from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.graphs.state import PsychTestState
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.prompts.loader import render_prompt


async def clarify_answer(state: PsychTestState, model: Any | None = None) -> dict:
    pending = state.get("pending_question") or {}
    messages = state.get("messages") or []
    if messages and isinstance(messages[-1], dict):
        answer_text = messages[-1].get("content", "")
    else:
        answer_text = ""
    system_prompt = render_prompt("psych_test", "system_prompt")
    user_prompt = render_prompt(
        "psych_test",
        "clarify_answer",
        question_text=pending.get("text", ""),
        answer_text=answer_text,
    )
    llm = model if model is not None else get_chat_model("minimax")
    reply = await call_llm(
        llm,
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ],
    )
    text = reply.content if isinstance(reply.content, str) else str(reply.content)
    return {"assistant_reply": text}
