"""Shared pytest fixtures for ai-runtime tests."""
from __future__ import annotations

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel


@pytest.fixture
def mock_minimax_model():
    """A FakeListChatModel that returns canned responses."""
    return FakeListChatModel(responses=["我理解你的感受，能多说说吗？"])


@pytest.fixture(autouse=True)
def _set_minimax_env(monkeypatch):
    """Every test gets a valid LANGGRAPH_MINIMAX_API_KEY env var."""
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")