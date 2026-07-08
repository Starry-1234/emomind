"""Embedding providers for the RAG question-selection subsystem.

QwenEmbeddingProvider wraps DashScope's text-embedding-v3 endpoint
(OpenAI-compatible) to embed user input and question bank for the
psych_test graph.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

import httpx

from app.config import Settings


class EmbeddingProvider(ABC):
    """Abstract base for embedding providers."""

    @property
    @abstractmethod
    def dim(self) -> int:
        """Embedding vector dimensionality (e.g. 1024 for text-embedding-v3)."""
        ...

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts; return one vector per input text."""
        ...


class QwenEmbeddingProvider(EmbeddingProvider):
    """Qwen text-embedding-v3 via DashScope (OpenAI-compatible POST)."""

    def __init__(self, settings: Settings):
        self._settings = settings

    @property
    def dim(self) -> int:
        return self._settings.embedding_dim

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        url = f"{self._settings.embedding_base_url.rstrip('/')}/embeddings"
        headers = {
            "Authorization": f"Bearer {self._settings.embedding_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._settings.embedding_model,
            "input": texts,
            "encoding_format": "float",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        # DashScope OpenAI-compatible response: {"data": [{"embedding": [...]}, ...]}
        return [item["embedding"] for item in data["data"]]