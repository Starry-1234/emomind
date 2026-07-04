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
