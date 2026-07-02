import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_requires_minimax_api_key():
    with pytest.raises(ValidationError):
        Settings(minimax_api_key="")


def test_settings_has_default_minimax_base_url(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    s = Settings()
    assert s.minimax_base_url.startswith("https://")


def test_settings_minimax_text_model_default():
    import os
    os.environ["LANGGRAPH_MINIMAX_API_KEY"] = "test-key"
    s = Settings()
    assert s.minimax_text_model  # non-empty