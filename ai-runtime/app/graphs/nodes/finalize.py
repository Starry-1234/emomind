"""Pick the final reply from analysis branches and stuff into analysis_result.

M3: finalize owns inline fusion for the multimodal path. Per-modality
analyze_* branches write into state['analyses'] (shallow-merged), then
finalize synthesizes them into a single fused reply via one MinMax
call. The old parallel `fusion_analyze` Send was dropped (M3 perf
cleanup) because it always ran against an empty-analyses slice and
returned `{"fused": ""}`, forcing finalize to do a second LLM call
as a defensive fallback — 2 LLM calls per multimodal run instead of 1.
Single-modality paths skip fusion entirely and return analyses[modality]
directly (no LLM call).
"""
from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.graphs.state import AiDoctorState
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.prompts.loader import render_prompt


async def finalize(state: AiDoctorState, model: Any | None = None) -> dict:
    analyses = state.get("analyses") or {}
    modality = state.get("modality") or "text"
    if modality == "multimodal" and analyses:
        # Synthesize all per-modality analyses into one fused response.
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
        return {"analysis_result": fused}
    # single-modality: use analyses[modality] with first-available fallback
    text = analyses.get(modality) or next(iter(analyses.values()), "")
    return {"analysis_result": text}
