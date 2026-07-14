"""Unit tests for generate_first_question (M3 Task 3).

Validates:
- RAG selects all available questions when bank has < 30 (6 of 6).
- Writes state fields: questions, current=0, pending_question,
  test_progress, phase, assistant_reply.
- ask_howto intent returns empty dict (route_by_intent handles routing).
- Length-based deterministic embeddings let us verify selection
  without needing real Qwen API keys.
"""
from __future__ import annotations

import json

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.generate_first_question import generate_first_question
from app.graphs.nodes._test_bank_cache import TestBankCache, ensure_loaded


@pytest.fixture
def mock_embedding():
    """Mock embedding provider returning 4-dim vectors keyed off text length.

    User input "我最近心情低落" is 7 chars => [0, 1, 2, 3] (7%7=0, 7%5=2,
    7%3=1, 7%2=1 -> wait, recalculate). The exact values don't matter
    for the assertion; only that selection is deterministic and
    reproducible across the 6-item test bank.
    """

    class _Fake:
        dim = 4

        async def embed(self, texts):
            return [
                [float(len(t) % 7), float(len(t) % 5), float(len(t) % 3), float(len(t) % 2)]
                for t in texts
            ]

    return _Fake()


@pytest.fixture(autouse=True)
def _reset_caches(monkeypatch):
    """Reset module-level cache between tests so monkeypatched paths take effect."""
    import app.graphs.nodes._test_bank_cache as cache_mod
    monkeypatch.setattr(cache_mod, "_cache", TestBankCache())


@pytest.mark.asyncio
async def test_generate_first_question_picks_30_questions(mock_embedding, tmp_path, monkeypatch):
    # 6 questions across 3 dims (mood:2, sleep:2, anxiety:2)
    bank = [
        {
            "id": f"{dim}_{i:02d}",
            "text": f"{dim} question {i}",
            "dimension": dim,
            "dimension_cn": dim,
            "keywords": "",
        }
        for dim, n in [("mood", 2), ("sleep", 2), ("anxiety", 2)]
        for i in range(n)
    ]
    bank_path = tmp_path / "question_bank.json"
    bank_path.write_text(json.dumps(bank, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr("app.graphs.nodes._test_bank_cache.QUESTION_BANK_PATH", bank_path)

    # Pre-populate cache
    await ensure_loaded(mock_embedding)

    fake_llm = FakeListChatModel(
        responses=["我理解你提到的心情问题，接下来我会针对这些方面出 6 道题。"]
    )
    state = {
        "messages": [{"role": "user", "content": "我最近心情低落"}],
        "user_id": "u1",
        "intent": "start_test",
    }
    out = await generate_first_question(
        state, model=fake_llm, embedding_provider=mock_embedding
    )

    assert "questions" in out
    assert len(out["questions"]) == 6  # all available
    assert out["current"] == 0
    assert "pending_question" in out
    assert "test_progress" in out
    assert out["test_progress"]["total"] == 6
    assert out["test_progress"]["current"] == 0
    assert out["phase"] == "testing"
    assert "assistant_reply" in out
    assert out["assistant_reply"].startswith("我理解")


@pytest.mark.asyncio
async def test_generate_first_question_uses_state_intent_ask_howto(
    mock_embedding, tmp_path, monkeypatch
):
    # When intent is ask_howto, generate_first_question should NOT run
    # (route_by_intent bypasses it). This is a safety check.
    state = {"intent": "ask_howto", "messages": []}
    out = await generate_first_question(
        state, model=None, embedding_provider=mock_embedding
    )
    # Returns empty dict (caller's route handles routing)
    assert out == {}