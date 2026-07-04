import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.fusion_analyze import fusion_analyze


@pytest.mark.asyncio
async def test_fusion_analyze_synthesizes_all_analyses(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    fake = FakeListChatModel(responses=["综合分析：基于图片和音频，这是综合报告。"])
    state = {
        "analyses": {
            "image": "图片显示蓝天。",
            "audio": "音频有紧张感。",
        },
        "user_id": "u1",
    }
    out = await fusion_analyze(state, model=fake)
    assert "fused" in out
    assert out["fused"].startswith("综合")
