"""Structured logging with PII scrubbing, plus Sentry initialisation.

Security rationale (§13.9): recipient names, addresses, emails, tokens, and
password hashes are PII or secrets and must never reach logs or Sentry. A
scrubbing processor runs on every structlog event and on stdlib log records
routed through structlog, redacting sensitive keys before they are rendered.
"""
from __future__ import annotations

import logging
from typing import Any

import structlog

from app.config import settings

# Keys whose values are PII or secrets and must be redacted from every log
# line and Sentry event. Matched case-insensitively.
SENSITIVE_KEYS: frozenset[str] = frozenset({
    "password",
    "hashed_password",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "email",
    "address",
    "raw_message",
    "location",
    "secret",
    "jwt_secret",
})

_REDACTED = "[REDACTED]"


def _scrub(value: Any) -> Any:
    """Recursively redact sensitive keys in dicts/lists."""
    if isinstance(value, dict):
        return {
            k: (_REDACTED if k.lower() in SENSITIVE_KEYS else _scrub(v))
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple)):
        return type(value)(_scrub(v) for v in value)
    return value


def scrub_pii(
    _logger: Any, _method: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """structlog processor: redact PII/secret keys from the event."""
    return _scrub(event_dict)


def configure_logging() -> None:
    """Configure structlog as the single JSON logging pipeline.

    Both structlog loggers and existing stdlib ``logging`` calls are routed
    through the same processor chain, so the PII scrubber applies everywhere.
    """
    shared: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        scrub_pii,
    ]

    structlog.configure(
        processors=[*shared, structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.JSONRenderer(),
        ],
    )
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(settings.LOG_LEVEL.upper())


def _sentry_before_send(
    event: dict[str, Any], _hint: dict[str, Any]
) -> dict[str, Any]:
    """Scrub PII from Sentry events before they leave the process."""
    return _scrub(event)


def init_sentry() -> None:
    """Initialise Sentry with PII scrubbing, if a DSN is configured."""
    if not settings.SENTRY_DSN:
        return
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        send_default_pii=False,  # never attach request bodies / headers
        before_send=_sentry_before_send,
        traces_sample_rate=0.1,
    )


def get_logger(name: str | None = None) -> Any:
    """Return a bound structlog logger."""
    return structlog.get_logger(name)
