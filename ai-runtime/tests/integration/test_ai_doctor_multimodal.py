"""End-to-end integration: ai_doctor graph with multimodal files.

Exercises the full graph (classify_input -> Send API -> branches
-> finalize) with a FakeListChatModel for the LLM calls.
"""
import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.ai_doctor import build_ai_doctor_graph
from app.memory.cache import write_file


@pytest.fixture
def tmp_storage(monkeypatch, tmp_path):
    """Override LANGGRAPH_STORAGE_PATH to a tmp dir for isolation."""
    from app.config import settings

    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "storage_path", str(tmp_path))
    return tmp_path


@pytest.mark.asyncio
async def test_text_only_path(tmp_storage, monkeypatch):
    graph = build_ai_doctor_graph()
    state = {
        "messages": [{"role": "user", "content": "我最近睡不好"}],
        "files": [],
        "user_id": "u1",
        "thread_id": "t1",
        "run_id": "r1",
    }
    # M1 path: text-only goes through analyze_text (MinMax).
    # We need to monkeypatch get_chat_model to return a fake.
    fake = FakeListChatModel(responses=["我理解你的感受，能多说说吗？"])
    monkeypatch.setattr(
        "app.graphs.nodes.analyze_text.get_chat_model",
        lambda name: fake,
    )
    result = await graph.ainvoke(state)
    assert "analysis_result" in result
    assert result["analysis_result"].startswith("我")


@pytest.mark.asyncio
async def test_multimodal_image_audio_path(tmp_storage, monkeypatch):
    # Upload one image and one audio
    img_meta = write_file(user_id="u1", content=b"PNG data", mime="image/png", name="i.png")
    aud_meta = write_file(user_id="u1", content=b"WAV data", mime="audio/wav", name="a.wav")
    state = {
        "messages": [{"role": "user", "content": "看看我这些"}],
        "files": [img_meta, aud_meta],
        "user_id": "u1",
        "thread_id": "t1",
        "run_id": "r1",
    }
    # All analyze_* nodes + fusion_analyze need fake models.
    fake_image = FakeListChatModel(responses=["图片描述"])
    fake_audio = FakeListChatModel(responses=["音频描述"])
    fake_fusion = FakeListChatModel(responses=["综合分析报告"])
    fake_finalize = FakeListChatModel(responses=["综合finalize回复"])
    monkeypatch.setattr(
        "app.graphs.nodes.analyze_image.get_chat_model", lambda name: fake_image
    )
    monkeypatch.setattr(
        "app.graphs.nodes.analyze_audio.get_chat_model", lambda name: fake_audio
    )
    monkeypatch.setattr(
        "app.graphs.nodes.fusion_analyze.get_chat_model", lambda name: fake_fusion
    )
    monkeypatch.setattr(
        "app.graphs.nodes.finalize.get_chat_model", lambda name: fake_finalize
    )
    graph = build_ai_doctor_graph()
    result = await graph.ainvoke(state)
    assert "analysis_result" in result
    # Final result should come from fusion_analyze (multimodal)
    assert "综合" in result["analysis_result"] or "image" in result["analysis_result"] or "audio" in result["analysis_result"]
    # Verify partial analyses were collected
    assert "image" in result["analyses"]
    assert "audio" in result["analyses"]
    assert "fused" in result and "综合" in result["fused"]
