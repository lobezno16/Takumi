from __future__ import annotations

from httpx import AsyncClient


async def test_health_returns_200(client: AsyncClient) -> None:
    """GET /health should return 200 with expected service metadata."""
    response = await client.get("/health")

    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "takumiroute-backend"


async def test_api_health_returns_200(client: AsyncClient) -> None:
    """GET /api/health (frontend proxy path) should return identical response."""
    response = await client.get("/api/health")

    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "takumiroute-backend"


async def test_health_has_security_headers(client: AsyncClient) -> None:
    """GET /health response should include all required security headers."""
    response = await client.get("/health")

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "max-age=" in response.headers["strict-transport-security"]
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "default-src" in response.headers["content-security-policy"]
    assert "server" not in response.headers
