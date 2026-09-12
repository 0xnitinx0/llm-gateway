from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed configuration keeps infrastructure choices visible and testable."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://gateway:gateway_password@localhost:5433/llm_gateway"
    redis_url: str = "redis://localhost:6379/0"
    admin_api_key: str = "admin-local-demo"
    demo_api_key: str = "gw_demo_local"
    rate_limit_demo_api_key: str = "gw_demo_rate"
    default_rate_capacity: int = 60
    default_rate_refill_per_second: float = 1.0
    cache_similarity_threshold: float = Field(default=0.82, ge=0.0, le=1.0)
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_model_path: str = ""
    embedding_dimensions: int = 384
    local_token_delay_ms: int = 35
    enabled_providers: str = "local"
    compression_min_tokens: int = 30
    compression_target_ratio: float = 0.70
    tournament_providers: str = "local-concise,local-analytical,local-practical"
    judge_provider: str = "local-judge"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    cerebras_api_key: str = ""
    cerebras_model: str = "llama-3.3-70b"

    @property
    def enabled_provider_names(self) -> List[str]:
        names = [item.strip() for item in self.enabled_providers.split(",") if item.strip()]
        return names or ["local"]

    @property
    def tournament_provider_names(self) -> List[str]:
        return [item.strip() for item in self.tournament_providers.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
