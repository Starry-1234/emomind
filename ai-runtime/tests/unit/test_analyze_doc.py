import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.analyze_doc import analyze_doc


@pytest.mark.asyncio
async def test_analyze_doc_calls_model_and_returns_analyses(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    fake = FakeListChatModel(responses=["文档分析：这是分析报告内容。"])
    state = {
        "doc_text": "原始文档内容",
        "user_id": "u1",
    }
    out = await analyze_doc(state, model=fake)
    assert "analyses" in out
    assert out["analyses"]["doc"].startswith("文档")
