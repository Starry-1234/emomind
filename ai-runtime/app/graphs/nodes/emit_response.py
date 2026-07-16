"""emit_response — M1 stub.

In M4 this node will emit an SSE 'message_end' event into the state and
trigger long-term memory writes. For M1 it's a no-op pass-through that
signals the graph to END. Real SSE emission happens in streaming.py at the
api/chat.py layer.

Typed as GraphState (the union parent) so this node can be reused by both
the ai_doctor and psych_test graphs without LangGraph filtering out keys
declared on PsychTestState (e.g., assistant_reply).

M4: After emit, schedule long-term memory extraction (fire-and-forget).
Only for ai_doctor (psych_test is one-shot report, no long-term needed).
Failures are caught and logged so they never block the SSE response.
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
            asyncio.create_task(extract_facts_and_persist(dict(state)))
    except Exception:
        # Never let the long-term schedule error block the SSE response
        pass
    return {}