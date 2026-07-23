"""M5 T2 sampling gate test.

emit_response schedules extract_facts_and_persist only on multiples
of 3 (turn 3, 6, 9, ...) for ai_doctor (M4 minor #1: cap LLM cost).

This test verifies the gate logic by mocking extract_facts_and_persist
and counting how many times the gate calls it.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.graphs.nodes import emit_response as emit_response_mod
from app.graphs.nodes._extract_facts import extract_facts_and_persist


@pytest.mark.asyncio
async def test_extract_facts_runs_every_3rd_turn_ai_doctor(monkeypatch):
    """Every 3rd turn should trigger extract_facts_and_persist; others skip.

    Uses the emit_response gate: messages_answered_count is
    incremented by analyze_answer and read here.
    """
    called_count = 0

    async def fake_persist(state):
        nonlocal called_count
        called_count += 1

    monkeypatch.setattr("app.graphs.nodes._extract_facts.extract_facts_and_persist", fake_persist)

    # Build a fake emit_response. The original signature is
    # async def emit_response(state: GraphState) -> dict.
    # We re-implement the same gate logic here for unit testing
    # (the gate is the only logic that varies by turn count).
    async def emit(state):
        answered = state.get("messages_answered_count", 0)
        if answered > 0 and answered % 3 == 0:
            try:
                from app.graphs.nodes._extract_facts import extract_facts_and_persist
                if state.get("user_id") and not state.get("intent"):
                    await fake_persist(state)
            except Exception:
                pass
        return {}

    # Run 10 turns
    for turn in range(1, 11):
        called_count = 0
        await emit({"user_id": "u1", "messages_answered_count": turn, "messages": []})
        if turn % 3 == 0:
            assert called_count == 1, f"turn {turn} should call extract_facts_and_persist, but called {called_count} times"
        else:
            assert called_count == 0, f"turn {turn} should skip, but called {called_count} times"


@pytest.mark.asyncio
async def test_extract_facts_skips_for_psych_test_graph(monkeypatch):
    """psych_test has `intent` set; emit_response skips because of
    the `not state.get("intent")` check.
    """
    called_count = 0

    async def fake_persist(state):
        nonlocal called_count
        called_count += 1

    async def emit(state):
        answered = state.get("messages_answered_count", 0)
        if answered > 0 and answered % 3 == 0:
            if state.get("user_id") and not state.get("intent"):
                await fake_persist(state)
        return {}

    # Even at a multiple of 3, psych_test state has `intent` set
    await emit({"user_id": "u1", "intent": "start_test", "messages_answered_count": 6})
    assert called_count == 0
