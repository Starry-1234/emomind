"""Module-level cache for the psych_test question bank.

Holds the 135 questions, their Qwen embeddings, and per-dimension
centroids. Loaded lazily on first call to ensure_loaded(); idempotent.

Centroid = mean of all question embeddings in that dimension
(used to rank dimensions by similarity to user input embedding).
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

QUESTION_BANK_PATH = (
    Path(__file__).parent.parent.parent / "test_templates" / "question_bank.json"
)


@dataclass
class TestBankCache:
    # Pytest sees the `Test` prefix and tries to collect the class as a
    # test class; mark it explicitly as not-a-test.
    __test__ = False

    questions: list[dict] = field(default_factory=list)
    question_embeddings: dict[str, list[float]] = field(default_factory=dict)
    dim_centroids: dict[str, list[float]] = field(default_factory=dict)
    loaded: bool = False


_cache = TestBankCache()


async def ensure_loaded(embedding_provider) -> TestBankCache:
    """Idempotent loader. Embeds all 135 questions on first call."""
    global _cache
    if _cache.loaded:
        return _cache
    raw = json.loads(QUESTION_BANK_PATH.read_text(encoding="utf-8"))
    _cache.questions = raw
    # Batch embed: send all texts in one call
    texts = [q["text"] for q in raw]
    vectors = await embedding_provider.embed(texts)
    _cache.question_embeddings = {q["id"]: v for q, v in zip(raw, vectors)}
    # Compute per-dimension centroids (mean of all question embeddings in that dim)
    by_dim: dict[str, list[list[float]]] = {}
    for q, v in zip(raw, vectors):
        by_dim.setdefault(q["dimension"], []).append(v)
    _cache.dim_centroids = {
        dim: _mean(vectors) for dim, vectors in by_dim.items()
    }
    _cache.loaded = True
    return _cache


def _mean(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        return []
    dim = len(vectors[0])
    sums = [0.0] * dim
    for v in vectors:
        for i, x in enumerate(v):
            sums[i] += x
    return [s / len(vectors) for s in sums]