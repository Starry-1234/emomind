import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.config import Settings
from app.models.factory import get_chat_model


@pytest.fixture
def settings(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("LANGGRAPH_QWEN_API_KEY", "test-key")
    return Settings()


def test_factory_qwen_returns_chat_model(settings):
    model = get_chat_model("qwen3-omni")
    assert model is not None
    # ChatOpenAI uses openai_api_base for the endpoint
    assert hasattr(model, "openai_api_base") or hasattr(model, "base_url")


def test_factory_qwen_returns_fresh_instance(settings):
    a = get_chat_model("qwen3-omni")
    b = get_chat_model("qwen3-omni")
    assert a is not b


def test_qwen_provider_uses_settings_url_and_key(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("LANGGRAPH_QWEN_API_KEY", "custom-qwen-key")
    monkeypatch.setenv("LANGGRAPH_QWEN_BASE_URL", "https://custom.example.com/v1")
    monkeypatch.setenv("LANGGRAPH_QWEN_MODEL", "qwen-custom")
    s = Settings()
    model = get_chat_model("qwen3-omni", _settings=s)
    # The model should be configured with the custom values
    # (langchain-openai 0.2.x exposes them as attributes)
    base = getattr(model, "openai_api_base", None) or getattr(model, "base_url", None)
    assert base == "https://custom.example.com/v1"