"""Pydantic settings for ai-runtime."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LANGGRAPH_", env_file=".env", extra="ignore")

    host: str = "0.0.0.0"
    port: int = 8000

    # Will be enforced in M1 — for M0 only "placeholder" is needed for config to load.
    internal_token: str = "m0-placeholder-token"
    database_url: str = "postgresql://localhost:5432/emomind"
    redis_url: str = "redis://localhost:6379"


settings = Settings()
