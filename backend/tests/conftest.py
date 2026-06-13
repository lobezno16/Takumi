"""Shared test fixtures for TakumiRoute backend tests."""
from __future__ import annotations

import os

# Force the test environment before any app import so settings (and the
# rate limiter, which is disabled under "test") initialise correctly.
os.environ["ENVIRONMENT"] = "test"

from collections.abc import AsyncGenerator  # noqa: E402

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP test client bound to the FastAPI application.

    Session-scoped to share the event loop and DB connection pool.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
