import pytest
from langchain_core.messages import AIMessage
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.analyze_text import analyze_text


@pytest.mark.asyncio
async def test_analyze_text_calls_model_and_returns_analyses(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")

    fake = FakeListChatModel(responses=["我理解你的感受，能多说说吗？"])

    state = {
        "messages": [{"role": "user", "content": "我最近很难入睡"}],
        "modality": "text",
    }
    out = await analyze_text(state, model=fake)
    assert "analyses" in out
    assert out["analyses"]["text"].startswith("我")