"""Qwen3-Omni provider — uses langchain-openai ChatOpenAI with DashScope's
OpenAI-compatible endpoint. Supports multimodal input (text + image/audio/video)."""
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.config import Settings
from app.models.base import ChatModelProvider


class QwenOmniProvider(ChatModelProvider):
    def __init__(self, settings: Settings):
        self._settings = settings

    def get(self) -> BaseChatModel:
        return ChatOpenAI(
            model=self._settings.qwen_model,
            openai_api_key=self._settings.qwen_api_key,
            openai_api_base=self._settings.qwen_base_url,
            temperature=0.7,
            max_tokens=2000,
            timeout=self._settings.request_timeout_seconds,
        )