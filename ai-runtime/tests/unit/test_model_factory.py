import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.config import Settings
from app.models.factory import get_chat_model


@pytest.fixture
def settings(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    return Settings()


def test_factory_known_provider_returns_model(settings):
    model = get_chat_model("minimax")
    assert model is not None
    # Should be a ChatOpenAI configured with MinMax base_url
    assert hasattr(model, "openai_api_base") or hasattr(model, "base_url")


def test_factory_unknown_provider_raises(settings):
    with pytest.raises(ValueError, match="Unknown provider"):
        get_chat_model("gpt-99-typo")


def test_factory_returns_fresh_instance_each_call(settings):
    a = get_chat_model("minimax")
    b = get_chat_model("minimax")
    assert a is not b  # don't share stateful clients by accident