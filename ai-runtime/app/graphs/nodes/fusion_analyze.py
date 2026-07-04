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
