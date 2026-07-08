"""Pydantic settings for ai-runtime."""
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LANGGRAPH_", env_file=".env", extra="ignore")

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Security
    internal_token: str = Field(default="m0-placeholder-token-must-be-32-chars", min_length=16)

    # PostgreSQL
    database_url: str = "postgresql://postgres:postgres@db:5432/emomind"

    # Redis
    redis_url: str = "redis://localhost:6390"

    # Storage
    storage_path: str = "/var/lib/emomind/files"
    max_file_size_mb: int = 50

    # LLM providers
    # M1: MinMax (text)
    minimax_api_key: str = Field(..., min_length=1)
    minimax_base_url: str = "https://api.minimax.chat/v1"
    minimax_text_model: str = "minimax-text-01"

    # M2: Qwen3-Omni (multimodal)
    qwen_api_key: str = Field(..., min_length=1)
    qwen_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    qwen_model: str = "qwen3-omni"

    # M3: embedding model (Qwen text-embedding-v3 via DashScope)
    embedding_api_key: str = Field(..., min_length=1)
    embedding_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    embedding_model: str = "text-embedding-v3"
    embedding_dim: int = 1024

    # Limits
    request_timeout_seconds: int = 120
    log_level: str = "INFO"


settings = Settings()  # type: ignore[call-arg]