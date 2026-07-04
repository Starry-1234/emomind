"""Pick the final reply from analysis branches and stuff into analysis_result.

M1: analyses[modality].
M2: if state['fused'] is set (multimodal path), use it; else
fall back to analyses[modality] (single-modality path).
If state['fused'] is unset but modality is 'multimodal', run fusion
inline here (defensive fallback in case the parallel fusion_analyze
Send slice did not see the merged analyses).
"""
from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.graphs.state import AiDoctorState
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.prompts.loader import render_prompt


async def finalize(state: AiDoctorState, model: Any | None = None) -> dict:
    fused = state.get("fused")
    inline_fused = False
    if not fused and (state.get("modality") == "multimodal"):
        analyses = state.get("analyses") or {}
        if analyses:
            parts = [f"【{mod}】{text}" for mod, text in analyses.items()]
            combined = "\n\n".join(parts)
            system_prompt = render_prompt("ai_doctor", "system_prompt")
            user_prompt = render_prompt(
                "ai_doctor", "fusion_analyze", combined=combined
            )
            llm = model if model is not None else get_chat_model("minimax")
            reply = await call_llm(
                llm,
                [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt),
                ],
            )
            fused = reply.content if isinstance(reply.content, str) else str(reply.content)
            inline_fused = True
    if fused:
        out: dict[str, Any] = {"analysis_result": fused}
        if inline_fused:
            # Mirror fusion_analyze's normal contract: write state.fused too.
            out["fused"] = fused
        return out
    analyses = state.get("analyses") or {}
    modality = state.get("modality") or "text"
    text = analyses.get(modality) or next(iter(analyses.values()), "")
    return {"analysis_result": text}
