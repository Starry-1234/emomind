"""Unit tests for analyze_answer (M3 Task 4).

Validates:
- 1 LLM call (FakeListChatModel returns canned JSON).
- Parses score (0-4) + emotion_tags.
- Appends to state.answers, state.emotion_tags, state.test_progress.scores[dim].
- Sets state.answer_ambiguous=False (M3 always).
"""
from __future__ import annotations

import json

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.analyze_answer import analyze_answer


@pytest.mark.asyncio
async def test_analyze_answer_appends_to_state(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    fake_response = json.dumps({"score": 3, "emotion_tags": ["焦虑", "紧张"]})
    fake = FakeListChatModel(responses=[fake_response])
    state = {
        "pending_question": {
            "id": "mood_001",
            "text": "你是否经常感到心情低落？",
            "dimension": "mood",
            "dimension_cn": "情绪",
        },
        "messages": [{"role": "user", "content": "是的，最近总是不开心"}],
        "answers": [],
        "emotion_tags": [],
        "test_progress": {"current": 0, "total": 30, "scores": {"mood": []}},
        "user_id": "u1",
    }
    out = await analyze_answer(state, model=fake)
    assert len(out["answers"]) == 1
    assert out["answers"][0]["question_id"] == "mood_001"
    assert out["answers"][0]["score"] == 3
    assert out["test_progress"]["scores"]["mood"] == [3]
    assert out["emotion_tags"] == ["焦虑", "紧张"]
    assert out["answer_ambiguous"] is False
