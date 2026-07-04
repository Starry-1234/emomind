import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.analyze_audio import analyze_audio
from app.memory.cache import write_file


@pytest.fixture
def tmp_storage(monkeypatch, tmp_path):
    """Override LANGGRAPH_STORAGE_PATH to a tmp dir for isolation."""
    from app.config import settings

    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "storage_path", str(tmp_path))
    return tmp_path


@pytest.mark.asyncio
async def test_analyze_audio_reads_file_and_calls_model(tmp_storage):
    fake = FakeListChatModel(responses=["音频内容描述。"])
    content = b"FAKE_WAV_DATA"
    meta = write_file(user_id="u1", content=content, mime="audio/wav", name="a.wav")
    state = {
        "files": [meta],
        "user_id": "u1",
    }
    out = await analyze_audio(state, model=fake)
    assert "analyses" in out
    assert out["analyses"]["audio"].startswith("音频")
