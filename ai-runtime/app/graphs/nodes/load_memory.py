"""load_memory — M3 stub. Returns {} (no long-term memory).

M4 will plug pgvector here. For M3, the graph proceeds without
memory context.
"""
from __future__ import annotations

from app.graphs.state import PsychTestState


async def load_memory(state: PsychTestState) -> dict:
    return {}