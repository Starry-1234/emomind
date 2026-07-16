"""Integration tests for extract_facts_and_persist (M4 Task 5).

Validates:
- extract_facts_and_persist roundtrip: extract -> embed -> upsert -> retrieve.
- Requires Postgres + pgvector; skipped otherwise (per T4 pattern).
- Mocks LLM + embedding provider at the module boundary to avoid
  external API calls; only the pgvector persistence path is real.
"""
import json
import sys
import uuid
import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes import _extract_facts as ef_mod
from app.graphs.nodes._extract_facts import extract_facts_and_persist, get_user_memory_store


class _FakeEmbedding:
    """Deterministic 1024-d embedding: each text maps to itself's hash."""

    dim = 1024

    async def embed(self, texts):
        out = []
        for t in texts:
            # Spread zeros with a tiny one-hot at index(hash(t) % dim) so
            # distinct texts have distinct vectors (cosine = 0); same text
            # -> exact same vector (cosine = 1).
            h = abs(hash(t)) % self.dim
            vec = [0.0] * self.dim
            vec[h] = 1.0
            out.append(vec)
        return out


@pytest.mark.asyncio
async def test_extract_facts_and_persist_inserts_into_pgvector(monkeypatch):
    # Mock LLM + embedding at the module boundary (real Postgres only).
    fake_llm = FakeListChatModel(responses=[
        json.dumps([{"key": "hobby", "value": "reading", "importance": 0.7}])
    ])
    fake_embed = _FakeEmbedding()
    monkeypatch.setattr(ef_mod, "get_chat_model", lambda *_a, **_kw: fake_llm)
    monkeypatch.setattr(ef_mod, "get_embedding_provider", lambda *_a, **_kw: fake_embed)

    try:
        store = await get_user_memory_store()
    except Exception as e:
        pytest.skip(f"Postgres unavailable: {e}")
    user_id = str(uuid.uuid4())

    state = {
        "messages": [{"role": "user", "content": "我最近喜欢读书"}],
        "user_id": user_id,
    }
    await extract_facts_and_persist(state)

    # Query with a similar text -> retrieve via cosine similarity
    facts = await store.retrieve(user_id, "what do you like to do", top_k=5)
    keys = {f.key for f in facts}
    assert "hobby" in keys
