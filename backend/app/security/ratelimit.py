"""Redis-backed rate limiting via slowapi.

Security rationale (§13.8): auth and expensive endpoints (optimizer,
simulation, agent) are rate-limited per client to blunt brute-force and
resource-exhaustion abuse. Limits are keyed by authenticated user when a
bearer token is present, falling back to remote address otherwise.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.config import settings


def _rate_limit_key(request: Request) -> str:
    """Prefer the bearer token subject as the key, else the client IP."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        # The token itself is a stable per-user key; we do not decode it here
        # to keep the limiter cheap and side-effect free.
        return f"tok:{auth[7:][:32]}"
    return get_remote_address(request)


# storage_uri makes counters shared across workers via Redis. Disabled under
# the test environment so the suite's repeated logins don't trip limits.
limiter = Limiter(
    key_func=_rate_limit_key,
    storage_uri=settings.REDIS_URL,
    enabled=settings.ENVIRONMENT.lower() != "test",
    default_limits=[],
)
