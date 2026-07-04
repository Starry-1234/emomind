import base64
import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.analyze_image import analyze_image
from app.memory.cache import write_file


@pytest.fixture
def tmp_storage(monkeypatch, tmp_path):
    """Override LANGGRAPH_STORAGE_PATH to a tmp dir for isolation."""
    from app.config import settings

    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "storage_path", str(tmp_path))
    return tmp_path


@pytest.mark.asyncio
async def test_analyze_image_reads_file_and_calls_model(tmp_storage):
    fake = FakeListChatModel(responses=["图中显示蓝天白云。"])
    content = b"\x89PNG fake data"
    meta = write_file(user_id="u1", content=content, mime="image/png", name="a.png")
    state = {
        "files": [meta],
        "user_id": "u1",
    }
    out = await analyze_image(state, model=fake)
    assert "analyses" in out
    assert out["analyses"]["image"].startswith("图")
