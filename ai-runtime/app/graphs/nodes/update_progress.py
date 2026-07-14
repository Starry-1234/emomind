"""M3 update_progress: pure logic. Increments state.test_progress.current.

route_after_answer reads state.current to decide next/clarify/complete.
"""
from __future__ import annotations

from app.graphs.state import PsychTestState


async def update_progress(state: PsychTestState) -> dict:
    progress = dict(state.get("test_progress") or {})
    current = progress.get("current", 0)
    progress["current"] = current + 1
    return {"test_progress": progress}
