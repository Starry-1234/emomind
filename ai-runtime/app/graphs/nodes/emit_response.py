"""emit_response — M1 stub.

In M4 this node will emit an SSE 'message_end' event into the state and
trigger long-term memory writes. For M1 it's a no-op pass-through that
signals the graph to END. Real SSE emission happens in streaming.py at the
api/chat.py layer.
"""
from __future__ import annotations

from app.graphs.state import AiDoctorState


async def emit_response(state: AiDoctorState) -> dict:
    return {}