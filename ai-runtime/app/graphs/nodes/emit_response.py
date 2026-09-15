"""emit_response — terminal graph node.

SSE emission happens upstream in `api/chat.py` (the streaming layer); this
node is a no-op pass-through that signals the graph to END.

After pass-through, schedule long-term memory extraction (fire-and-forget,
via `asyncio.create_task`). Only for `ai_doctor` — `psych_test` is a
one-shot report and does not write long-term memory. Failures are caught
and logged so they never block the SSE response.

Typed as `GraphState` (the union parent) so this node can be reused by
both `ai_doctor` and `psych_test` graphs without LangGraph filtering out
keys declared on `PsychTestState` (e.g. `assistant_reply`).

M5 minor #1: extraction is sampled every 3rd turn (gated by
`messages_answered_count % 3 == 0`) to cap LLM cost.
"""
from __future__ import annotations

import asyncio
from typing import Any

from app.graphs.state import GraphState


async def emit_response(state: GraphState) -> dict:
    # Existing emit code (unchanged) ...

    # M4: After emit, schedule long-term memory extraction (fire-and-forget).
    # Only for ai_doctor (psych_test is one-shot report, no long-term needed).
    # Graph discriminator: PsychTestState always carries an `intent` key
    # (set by intent_classifier on the first hop). ai_doctor doesn't use it.
    try:
        from app.graphs.nodes._extract_facts import extract_facts_and_persist
        if state.get("user_id") and not state.get("intent"):
            # M5 minor #1: sample every 3rd turn to cap LLM cost.
            # analyze_answer incremented messages_answered_count by 1
            # on the answer; we extract on multiples of 3 (turn 3, 6, 9, ...).
            answered_count = state.get("messages_answered_count", 0)
            if answered_count > 0 and answered_count % 3 == 0:
                asyncio.create_task(extract_facts_and_persist(dict(state)))
    except Exception:
        # Never let the long-term schedule error block the SSE response
        pass
    return {}