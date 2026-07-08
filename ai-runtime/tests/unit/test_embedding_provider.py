import pytest
from app.config import Settings
from app.models.factory import get_embedding_provider


@pytest.fixture
def settings(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("LANGGRAPH_QWEN_API_KEY", "test-key")
    monkeypatch.setenv("LANGGRAPH_EMBEDDING_API_KEY", "test-key")
    return Settings()


def test_factory_text_embedding_v3_returns_provider(settings):
    provider = get_embedding_provider("text-embedding-v3")
    assert provider is not None


def test_factory_unknown_embedding_provider_raises(settings):
    with pytest.raises(ValueError, match="Unknown embedding provider"):
        get_embedding_provider("unknown-embedding")


def test_embedding_provider_dim_matches_settings(settings):
    from app.models.embedding import QwenEmbeddingProvider
    provider = QwenEmbeddingProvider(settings)
    assert provider.dim == 1024