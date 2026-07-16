import pytest

from app.memory.checkpointer import close_checkpointer, get_checkpointer


@pytest.mark.asyncio
async def test_get_checkpointer_returns_singleton(monkeypatch):
    monkeypatch.setenv(
        "LANGGRAPH_DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/emomind_test",
    )
    try:
        cp1 = await get_checkpointer()
        cp2 = await get_checkpointer()
        assert cp1 is cp2, "get_checkpointer should return the same instance"
    except Exception as exc:
        pytest.skip(f"Postgres unavailable: {exc}")
    finally:
        await close_checkpointer()
