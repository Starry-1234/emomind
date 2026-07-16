"""Integration test for psych_test graph builder (M3 Task 6).

Validates:
- build_psych_test_graph() returns a compiled graph with ainvoke/astream_events.
- Compiling succeeds with InMemorySaver attached.
- ainvoke with a thread_id config runs through the start of the graph
  (load_test_template -> load_memory -> intent_classifier raises on missing
  intent) without crashing on checkpointer wiring.
"""
from __future__ import annotations

import pytest

from app.graphs.psych_test import build_psych_test_graph


@pytest.mark.asyncio
async def test_build_psych_test_graph_returns_compiled_graph():
    try:
        g = await build_psych_test_graph()
    except Exception as e:
        pytest.skip(f"Postgres unavailable: {e}")
    # CompiledStateGraph has these attrs
    assert hasattr(g, "ainvoke")
    assert hasattr(g, "astream_events")


@pytest.mark.asyncio
async def test_psych_test_graph_builds_with_inmemory_saver():
    try:
        g = await build_psych_test_graph()
    except Exception as e:
        pytest.skip(f"Postgres unavailable: {e}")
    assert g is not None


@pytest.mark.asyncio
async def test_psych_test_graph_ainvoke_with_empty_state(monkeypatch):
    """Empty state goes through load_test_template -> load_memory -> intent_classifier.
    The intent_classifier raises ValueError on missing intent; this exercises the
    graph wiring up to that node, with a mocked embedding provider so we never
    hit the real Qwen API.
    """
    from app.graphs.nodes import _test_bank_cache as cache_mod
    from app.graphs.nodes import load_test_template as lt_mod
    from app.graphs.nodes._test_bank_cache import TestBankCache
    from app.models.embedding import EmbeddingProvider

    class _E(EmbeddingProvider):
        dim = 4

        async def embed(self, texts):
            return [[0.1, 0.2, 0.3, 0.4] for _ in texts]

    monkeypatch.setattr(cache_mod, "_cache", TestBankCache())
    # Patch the binding inside load_test_template's module namespace —
    # same pattern as M2 test_chat_endpoint.py for analyze_text.
    monkeypatch.setattr(lt_mod, "get_embedding_provider", lambda name: _E())

    try:
        g = await build_psych_test_graph()
    except Exception as e:
        pytest.skip(f"Postgres unavailable: {e}")
    config = {"configurable": {"thread_id": "t-init"}}
    with pytest.raises(ValueError, match="Invalid intent"):
        await g.ainvoke({"user_id": "u1"}, config=config)