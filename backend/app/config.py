from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    DATABASE_URL: str = (
        "postgresql+asyncpg://takumi:takumi_dev@postgres:5432/takumiroute"
    )
    REDIS_URL: str = "redis://redis:6379/0"
    OSRM_URL: str = "http://osrm:5000"
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    SENTRY_DSN: str = ""
    ANTHROPIC_API_KEY: str = ""
    ENVIRONMENT: str = "development"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


settings = Settings()
