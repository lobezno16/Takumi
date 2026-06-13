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
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    SENTRY_DSN: str = ""
    ANTHROPIC_API_KEY: str = ""
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Security limits
    MAX_REQUEST_BODY_BYTES: int = 1_000_000  # 1 MB
    RATE_LIMIT_AUTH: str = "30/minute"
    RATE_LIMIT_EXPENSIVE: str = "60/minute"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",
    }

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in {"production", "prod", "staging"}


settings = Settings()

# Fail fast: never run a production environment with an unsigned/empty JWT
# secret. Security rationale — an empty HS256 key makes tokens forgeable.
if settings.is_production and not settings.JWT_SECRET:
    raise RuntimeError("JWT_SECRET must be set in production environments")
