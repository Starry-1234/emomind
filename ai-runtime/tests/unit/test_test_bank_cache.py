"""Unit tests for the module-level test bank cache (M3).

Validates:
- `ensure_loaded` populates questions, embeddings, and centroids on first call.
- `ensure_loaded` is idempotent — subsequent calls return the same instance
  without re-reading the bank or re-embedding.

The fixture bank has only 2-3 questions (per-dimension) so tests stay fast.
Production uses 135 questions (9 dims x 15) loaded from
`app/test_templates/question_bank.json`; coverage of the full bank is
exercised by integration tests, not unit tests.
"""
from __future__ import annotations

import pytest

from app.graphs.nodes import _test_bank_cache as mod
from app.graphs.nodes._test_bank_cache import TestBankCache, ensure_loaded


@pytest.fixture
def mock_embedding_provider():
    """Mock embedding provider returns deterministic 4-dim vectors.

    Question at index i gets vector [i, i+1, i+2, i+3]. This makes
    centroid arithmetic easy to verify by hand.
    """
    class _FakeProvider:
        dim = 4

        async def embed(self, texts):
            return [[float(i), float(i + 1), float(i + 2), float(i + 3)] for i in range(len(texts))]

    return _FakeProvider()


@pytest.fixture
def small_bank_path(tmp_path):
    """A 3-question bank (2 'mood' + 1 'interest') written to tmp_path."""
    bank = [
        {"id": "mood_001", "text": "Q1", "dimension": "mood", "dimension_cn": "情绪", "keywords": ""},
        {"id": "mood_002", "text": "Q2", "dimension": "mood", "dimension_cn": "情绪", "keywords": ""},
        {"id": "interest_001", "text": "Q3", "dimension": "interest", "dimension_cn": "兴趣", "keywords": ""},
    ]
    p = tmp_path / "question_bank.json"
    p.write_text(__import__("json").dumps(bank, ensure_ascii=False), encoding="utf-8")
    return p


@pytest.fixture(autouse=True)
def _reset_module_cache(monkeypatch):
    """Reset module-level _cache between tests to prevent pollution.

    Per the task brief: without this, a test that loads a bank leaks
    state into subsequent tests that monkeypatch QUESTION_BANK_PATH.
    """
    monkeypatch.setattr(mod, "_cache", TestBankCache())


@pytest.mark.asyncio
async def test_ensure_loaded_populates_cache(mock_embedding_provider, small_bank_path, monkeypatch):
    monkeypatch.setattr(mod, "QUESTION_BANK_PATH", small_bank_path)
    cache = await ensure_loaded(mock_embedding_provider)
    assert cache.loaded
    assert len(cache.questions) == 3
    assert "mood_001" in cache.question_embeddings
    assert "mood_002" in cache.question_embeddings
    assert "interest_001" in cache.question_embeddings
    # mood_001 -> [0,1,2,3]; mood_002 -> [1,2,3,4]; mean -> [0.5, 1.5, 2.5, 3.5]
    assert cache.dim_centroids["mood"] == [0.5, 1.5, 2.5, 3.5]
    # interest_001 -> [2,3,4,5] (only one vector in this dim)
    assert cache.dim_centroids["interest"] == [2.0, 3.0, 4.0, 5.0]


@pytest.mark.asyncio
async def test_ensure_loaded_is_idempotent(mock_embedding_provider, small_bank_path, monkeypatch):
    monkeypatch.setattr(mod, "QUESTION_BANK_PATH", small_bank_path)
    cache1 = await ensure_loaded(mock_embedding_provider)
    cache2 = await ensure_loaded(mock_embedding_provider)
    # Same singleton returned, no re-read or re-embed.
    assert cache1 is cache2
    assert len(mod._cache.questions) == 3
    assert mod._cache.loaded is True