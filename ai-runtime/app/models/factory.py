"""Factory for ChatModel providers."""
from functools import lru_cache

from langchain_core.language_models import BaseChatModel

from app.config import Settings, settings as _settings
from app.models.base import ChatModelProvider
from app.models.embedding import EmbeddingProvider, QwenEmbeddingProvider
from app.models.minimax import MinMaxProvider
from app.models.qwen_omni import QwenOmniProvider

_PROVIDERS: dict[str, type[ChatModelProvider]] = {
    "minimax": MinMaxProvider,
    "qwen3-omni": QwenOmniProvider,
}

_EMBEDDING_PROVIDERS: dict[str, type[EmbeddingProvider]] = {
    "text-embedding-v3": QwenEmbeddingProvider,
}


def get_chat_model(provider: str, *, _settings: Settings | None = None) -> BaseChatModel:
    """Return a fresh ChatModel instance for the given provider.

    Note: each call returns a new instance — LangChain ChatModels are
    cheap to construct; we don't cache at this layer to keep test
    isolation simple.
    """
    s = _settings or __import__("app.config", fromlist=["settings"]).settings
    cls = _PROVIDERS.get(provider)
    if cls is None:
        raise ValueError(f"Unknown provider: {provider!r}. Known: {list(_PROVIDERS)}")
    return cls(s).get()


def get_embedding_provider(provider: str, *, _settings: Settings | None = None) -> EmbeddingProvider:
    """Return a fresh EmbeddingProvider instance for the given provider name."""
    s = _settings or __import__("app.config", fromlist=["settings"]).settings
    cls = _EMBEDDING_PROVIDERS.get(provider)
    if cls is None:
        raise ValueError(
            f"Unknown embedding provider: {provider!r}. Known: {list(_EMBEDDING_PROVIDERS)}"
        )
    return cls(s)
