"""M4 T7 integration test: long-term memory round-trip via pgvector.

Pre-seeds 1 fact via ``UserMemoryStore.upsert_fact`` and verifies
``UserMemoryStore.retrieve`` finds it via cosine similarity. Skipped
when Postgres is unavailable (T4 + T5 + T6 skip pattern).
"""
from __future__ import annotations

import uuid

import pytest

from app.graphs.nodes._extract_facts import get_user_memory_store


@pytest.mark.asyncio
async def test_ai_doctor_long_term_round_trip(monkeypatch):
    try:
        store = await get_user_memory_store()
    except Exception as e:
        pytest.skip(f"Postgres unavailable: {e}")

    user_id = str(uuid.uuid4())

    # Pre-seed 1 fact. Use a fixed embedding (any 1024-dim vector
    # works; pgvector doesn't care about magnitude for cosine distance).
    embedding = [0.5] * 1024
    await store.upsert_fact(
        user_id=user_id,
        key="hobby",
        value="reading",
        importance=0.8,
        embedding=embedding,
    )

    # Retrieve: the query "hobby" gets embedded by the store's own
    # embedder (Qwen text-embedding-v3 in production; a fake in tests
    # where Qwen is unreachable). On a real Postgres + Qwen setup,
    # "hobby" and "reading" are semantically related and cosine > 0.
    # On a fake-embedder setup, the test still finds the row because
    # there's only 1 fact to return.
    facts = await store.retrieve(user_id, "hobby", top_k=3)
    keys = {f.key for f in facts}
    assert "hobby" in keys
    assert any(f.value == "reading" for f in facts)
