"""load_test_template — M3 psych_test graph node.

Triggers the module-level cache initialization on first call. The
actual cache state is module-level (TestBankCache); this node is
a graph-flow marker that ensures the cache is ready before
generate_first_question runs.
"""
from __future__ import annotations

from app.graphs.nodes._test_bank_cache import ensure_loaded
from app.graphs.state import PsychTestState
from app.models.factory import get_embedding_provider


async def load_test_template(state: PsychTestState) -> dict:
    """Initialize the test-bank cache. No state writes (data lives in module)."""
    embedding_provider = get_embedding_provider("text-embedding-v3")
    await ensure_loaded(embedding_provider)
    return {}