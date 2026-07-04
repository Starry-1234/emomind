"""Shared pytest fixtures for ai-runtime tests."""
from __future__ import annotations

import os

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

# Module-level env defaults so that `from app.config import Settings`
# (which fires `settings = Settings()` at import time during pytest
# collection) doesn't ValidationError when the autouse fixture below
# hasn't yet run. These are placeholders only; the autouse fixture
# re-sets them via monkeypatch.setenv to keep per-test isolation.
os.environ.setdefault("LANGGRAPH_MINIMAX_API_KEY", "test-key")
os.environ.setdefault("LANGGRAPH_QWEN_API_KEY", "test-key")


@pytest.fixture
def mock_minimax_model():
    """A FakeListChatModel that returns canned responses."""
    return FakeListChatModel(responses=["我理解你的感受，能多说说吗？"])


@pytest.fixture(autouse=True)
def _set_llm_env(monkeypatch):
    """Every test gets valid LANGGRAPH_MINIMAX_API_KEY and LANGGRAPH_QWEN_API_KEY."""
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("LANGGRAPH_QWEN_API_KEY", "test-key")