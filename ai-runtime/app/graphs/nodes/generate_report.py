"""M3 generate_report: aggregate scores + LLM interpretation.

Computes per-dimension aggregates (sum of item scores, each item max 4)
and a total, then makes one MinMax LLM call to produce an empathetic
interpretation + recommendations. Writes state.report.

The dimension -> Chinese-label map is read straight from the question
bank JSON (no embeddings needed here), keeping this node network-free
apart from the single LLM call.
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.graphs.nodes._test_bank_cache import QUESTION_BANK_PATH
from app.graphs.state import PsychTestState
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.prompts.loader import render_prompt

_MAX_PER_ITEM = 4


@lru_cache(maxsize=1)
def _dim_to_cn() -> dict[str, str]:
    """dimension key -> Chinese label, read from the question bank JSON."""
    try:
        raw = json.loads(QUESTION_BANK_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    return {q["dimension"]: q.get("dimension_cn", q["dimension"]) for q in raw}


def _level(normalized: float) -> str:
    """Map 0-100% to a Chinese severity label."""
    if normalized < 25:
        return "轻微"
    if normalized < 50:
        return "中度"
    if normalized < 75:
        return "偏高"
    return "显著"


async def generate_report(state: PsychTestState, model: Any | None = None) -> dict:
    progress = state.get("test_progress") or {}
    scores_by_dim: dict[str, list[int]] = progress.get("scores") or {}
    emotion_tags = state.get("emotion_tags") or []
    dim_cn = _dim_to_cn()

    dim_breakdown: dict[str, dict] = {}
    total_score = 0
    total_max = 0
    total_normalized_sum = 0.0
    n_dims = 0
    for dim, scores in scores_by_dim.items():
        if not scores:
            continue
        dim_score = sum(scores)
        dim_max = len(scores) * _MAX_PER_ITEM
        dim_normalized = (dim_score / dim_max * 100) if dim_max else 0
        dim_breakdown[dim] = {
            "dimension_cn": dim_cn.get(dim, dim),
            "score": dim_score,
            "max": dim_max,
            "normalized": round(dim_normalized, 1),
            "level": _level(dim_normalized),
        }
        total_score += dim_score
        total_max += dim_max
        total_normalized_sum += dim_normalized
        n_dims += 1
    total_normalized = (total_normalized_sum / n_dims) if n_dims else 0

    # LLM interpretation + recommendations
    system_prompt = render_prompt("psych_test", "system_prompt")
    user_prompt = render_prompt(
        "psych_test",
        "generate_report",
        total_score=total_score,
        total_max=total_max,
        total_normalized=round(total_normalized, 1),
        dimension_breakdown=dim_breakdown,
        emotion_tags=emotion_tags,
    )
    llm = model if model is not None else get_chat_model("minimax")
    reply = await call_llm(
        llm,
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ],
    )
    full_text = reply.content if isinstance(reply.content, str) else str(reply.content)
    # Split into interpretation + recommendations at the "建议：" boundary.
    if "建议：" in full_text:
        idx = full_text.index("建议：")
        interpretation = full_text[:idx].strip()
        recommendations = full_text[idx:].strip()
    else:
        interpretation = full_text
        recommendations = ""

    return {
        "report": {
            "total_score": total_score,
            "total_max": total_max,
            "total_normalized": round(total_normalized, 1),
            "dimension_breakdown": dim_breakdown,
            "interpretation": interpretation,
            "recommendations": recommendations,
        }
    }
