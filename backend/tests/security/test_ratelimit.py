"""Security test (§13.8) — slowapi rate limiting returns 429 past the limit.

The application limiter is disabled under the test environment so the suite's
repeated logins don't trip it; this test exercises the same slowapi
integration (limiter + exception handler) on an isolated app to prove the
mechanism and the 429 response shape.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


async def test_rate_limit_returns_429_past_threshold() -> None:
    limiter = Limiter(key_func=get_remote_address, default_limits=[])
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @app.get("/ping")
    @limiter.limit("2/minute")
    async def ping(request: Request) -> dict[str, bool]:
        return {"ok": True}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t") as ac:
        first = await ac.get("/ping")
        second = await ac.get("/ping")
        third = await ac.get("/ping")

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
