"""emit_response — M1 stub.

In M4 this node will emit an SSE 'message_end' event into the state and
trigger long-term memory writes. For M1 it's a no-op pass-through that
signals the graph to END. Real SSE emission happens in streaming.py at the
api/chat.py layer.

Typed as GraphState (the union parent) so this node can be reused by both
the ai_doctor and psych_test graphs without LangGraph filtering out keys
declared on PsychTestState (e.g., assistant_reply).
"""
from __future__ import annotations

from typing import Any

from app.graphs.state import GraphState


async def emit_response(state: GraphState) -> dict:
    return {}