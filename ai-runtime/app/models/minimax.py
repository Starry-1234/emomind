"""MinMax provider — uses langchain-openai ChatOpenAI with MinMax's OpenAI-compatible endpoint."""
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.config import Settings
from app.models.base import ChatModelProvider


class MinMaxProvider(ChatModelProvider):
    def __init__(self, settings: Settings):
        self._settings = settings

    def get(self) -> BaseChatModel:
        return ChatOpenAI(
            model=self._settings.minimax_text_model,
            openai_api_key=self._settings.minimax_api_key,
            openai_api_base=self._settings.minimax_base_url,
            temperature=0.7,
            max_tokens=2000,
            timeout=self._settings.request_timeout_seconds,
        )