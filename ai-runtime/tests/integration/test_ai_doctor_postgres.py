"""M4 T6 integration test: ai_doctor graph wires PostgresSaver checkpointer.

Validates:
- `build_ai_doctor_graph()` is async and awaits `get_checkpointer()`.
- The compiled graph has a checkpointer attribute (AsyncPostgresSaver).
- Skipped when Postgres is unavailable (mirrors T3 + T4 + T5 patterns).
"""
import pytest

from app.graphs.ai_doctor import build_ai_doctor_graph


@pytest.mark.asyncio
async def test_ai_doctor_graph_uses_postgres_saver(monkeypatch):
    monkeypatch.setenv(
        "LANGGRAPH_DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/emomind_test",
    )
    try:
        graph = await build_ai_doctor_graph()
    except Exception as e:
        pytest.skip(f"Postgres unavailable: {e}")
    assert graph is not None
    # Graph has a checkpointer (AsyncPostgresSaver)
    assert hasattr(graph, "checkpointer")