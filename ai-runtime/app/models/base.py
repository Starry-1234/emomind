"""Abstract base for ChatModel providers."""
from abc import ABC, abstractmethod

from langchain_core.language_models import BaseChatModel


class ChatModelProvider(ABC):
    @abstractmethod
    def get(self) -> BaseChatModel: ...