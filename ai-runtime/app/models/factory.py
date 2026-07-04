"""Factory for ChatModel providers."""
from functools import lru_cache

from langchain_core.language_models import BaseChatModel

from app.config import Settings, settings as _settings
from app.models.base import ChatModelProvider
from app.models.minimax import MinMaxProvider
from app.models.qwen_omni import QwenOmniProvider

_PROVIDERS: dict[str, type[ChatModelProvider]] = {
    "minimax": MinMaxProvider,
    "qwen3-omni": QwenOmniProvider,
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
