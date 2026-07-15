"""Unit tests for extract_facts (M4 Task 5).

Validates:
- LLM call (FakeListChatModel) -> parse JSON list -> [{key, value, importance}].
- Message normalization accepts dict messages with `role`/`content`.
"""
from __future__ import annotations

import json
import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from app.graphs.nodes._extract_facts import extract_facts


@pytest.mark.asyncio
async def test_extract_facts_parses_llm_json_output(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    fake = FakeListChatModel(responses=[
        '[{"key": "favorite_color", "value": "blue", "importance": 0.3}]'
    ])
    state = {
        "messages": [{"role": "user", "content": "我最喜欢蓝色"}],
        "user_id": "00000000-0000-0000-0000-000000000001",
    }
    facts = await extract_facts(state, model=fake)
    assert len(facts) == 1
    assert facts[0]["key"] == "favorite_color"
    assert facts[0]["importance"] == 0.3
