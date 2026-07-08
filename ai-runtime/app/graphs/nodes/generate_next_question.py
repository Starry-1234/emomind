"""M3 generate_next_question: read state.questions[state.current] into pending_question.

Simple list lookup — no LLM call. Increments state.current by 1 so the
SSE for the new question carries the incremented index for UI display.
"""
from __future__ import annotations

from typing import Any

from app.graphs.nodes._test_bank_cache import ensure_loaded
from app.graphs.state import PsychTestState
from app.models.factory import get_embedding_provider


async def generate_next_question(
    state: PsychTestState, model: Any | None = None
) -> dict:
    """Increment state.current; look up the next question from cache.

    Returns empty dict when past the end of the questions list.
    """
    questions = state.get("questions") or []
    current = state.get("current") or 0
    if current >= len(questions):
        return {}
    embedding_provider = get_embedding_provider("text-embedding-v3")
    cache = await ensure_loaded(embedding_provider)
    qid_to_q = {q["id"]: q for q in cache.questions}
    qid = questions[current]
    pending = qid_to_q.get(qid)
    if pending is None:
        return {}
    return {
        "current": current + 1,
        "pending_question": pending,
    }