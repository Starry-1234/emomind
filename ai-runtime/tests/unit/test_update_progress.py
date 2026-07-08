"""Unit tests for update_progress (M3 Task 4).

Validates:
- Increments state.test_progress.current by 1.
- Handles missing test_progress gracefully (defaults current=0 -> 1).
"""
from __future__ import annotations

import pytest

from app.graphs.nodes.update_progress import update_progress


@pytest.mark.asyncio
async def test_update_progress_increments_current():
    state = {"test_progress": {"current": 5, "total": 30, "scores": {}}}
    out = await update_progress(state)
    assert out["test_progress"]["current"] == 6


@pytest.mark.asyncio
async def test_update_progress_handles_missing_progress():
    state = {}
    out = await update_progress(state)
    assert out["test_progress"]["current"] == 1
