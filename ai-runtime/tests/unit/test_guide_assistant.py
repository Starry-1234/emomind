"""Unit tests for guide_assistant (M3 Task 5).

Validates:
- 1 LLM call (FakeListChatModel returns canned reply).
- Sets state.assistant_reply.
"""
from __future__ import annotations

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.guide_assistant import guide_assistant


@pytest.mark.asyncio
async def test_guide_assistant_sets_assistant_reply(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    fake = FakeListChatModel(responses=["你好，我是小心。心理测评能帮你了解自己的状态。"])
    state = {
        "messages": [{"role": "user", "content": "这个测试怎么用？"}],
        "user_id": "u1",
    }
    out = await guide_assistant(state, model=fake)
    assert "assistant_reply" in out
    assert out["assistant_reply"].startswith("你好")
