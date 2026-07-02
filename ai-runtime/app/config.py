"""Pydantic settings for ai-runtime."""
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LANGGRAPH_", env_file=".env", extra="ignore")

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Security (already required, kept)
    # Will be enforced in M1 — for M0 only "placeholder" is needed for config to load.
    internal_token: str = Field(default="m0-placeholder-token-must-be-32-chars", min_length=16)

    # PostgreSQL (kept)
    database_url: str = "postgresql://postgres:postgres@db:5432/emomind"

    # Default points at the host-side port mapped by compose.override.yml
    # (6390 -> container 6379). Override via LANGGRAPH_REDIS_URL env var
    # when running inside compose: `redis://redis:6379`.
    redis_url: str = "redis://localhost:6390"

    # Storage
    storage_path: str = "/var/lib/emomind/files"

    # LLM providers (M1 only needs MinMax text; Qwen3-Omni for M2)
    minimax_api_key: str = Field(..., min_length=1)
    minimax_base_url: str = "https://api.minimax.chat/v1"
    minimax_text_model: str = "minimax-text-01"

    # Limits
    request_timeout_seconds: int = 120
    log_level: str = "INFO"


settings = Settings()  # type: ignore[call-arg]