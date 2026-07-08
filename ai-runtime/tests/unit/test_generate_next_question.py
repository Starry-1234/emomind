"""Unit tests for generate_next_question (M3 Task 3).

Validates:
- Increments state.current; sets pending_question to questions[current].
- Returns empty dict when current >= len(questions) (past end).
"""
from __future__ import annotations

import json

import pytest

from app.graphs.nodes.generate_next_question import generate_next_question
from app.graphs.nodes._test_bank_cache import TestBankCache, ensure_loaded


@pytest.fixture
def mock_embedding():
    class _Fake:
        dim = 4

        async def embed(self, texts):
            return [[float(i), float(i + 1), float(i + 2), float(i + 3)] for i in range(len(texts))]

    return _Fake()


@pytest.fixture(autouse=True)
def _reset_cache(monkeypatch):
    import app.graphs.nodes._test_bank_cache as cache_mod
    monkeypatch.setattr(cache_mod, "_cache", TestBankCache())


@pytest.mark.asyncio
async def test_generate_next_question_increments_current(
    mock_embedding, tmp_path, monkeypatch
):
    bank = [
        {
            "id": f"mood_{i:02d}",
            "text": f"Q{i}",
            "dimension": "mood",
            "dimension_cn": "情绪",
            "keywords": "",
        }
        for i in range(3)
    ]
    bank_path = tmp_path / "question_bank.json"
    bank_path.write_text(json.dumps(bank, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr("app.graphs.nodes._test_bank_cache.QUESTION_BANK_PATH", bank_path)
    await ensure_loaded(mock_embedding)

    state = {
        "questions": ["mood_00", "mood_01", "mood_02"],
        "current": 1,  # already answered Q0; next question is Q1
    }
    out = await generate_next_question(state, model=None)
    assert out["current"] == 2  # incremented
    assert out["pending_question"]["id"] == "mood_01"  # the question just emitted


@pytest.mark.asyncio
async def test_generate_next_question_at_end_returns_empty(
    mock_embedding, tmp_path, monkeypatch
):
    bank_path = tmp_path / "question_bank.json"
    bank_path.write_text(
        json.dumps(
            [
                {
                    "id": "mood_00",
                    "text": "Q",
                    "dimension": "mood",
                    "dimension_cn": "情绪",
                    "keywords": "",
                }
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr("app.graphs.nodes._test_bank_cache.QUESTION_BANK_PATH", bank_path)
    await ensure_loaded(mock_embedding)

    state = {"questions": ["mood_00"], "current": 1}  # past end
    out = await generate_next_question(state, model=None)
    assert out == {}