"""Tests for Phase 3 — Auth, JWT, and CRUD APIs.

All tests share a session-scoped event loop and client, so multi-step
DB operations (register → login → use token) work correctly.
"""
from __future__ import annotations

import uuid

from httpx import AsyncClient


def _unique_email() -> str:
    """Generate a unique email for test isolation."""
    return f"test-{uuid.uuid4().hex[:8]}@takumiroute.jp"


# ── Auth unit tests (no DB needed) ────────────────────────────────────

async def test_password_hashing() -> None:
    """Argon2 hashing should produce verifiable hashes."""
    from app.security.auth import hash_password, verify_password

    hashed = hash_password("mysecretpassword")
    assert hashed != "mysecretpassword"
    assert hashed.startswith("$argon2")
    assert verify_password("mysecretpassword", hashed) is True
    assert verify_password("wrongpassword", hashed) is False


async def test_jwt_roundtrip() -> None:
    """JWT creation and decoding should round-trip the subject claim."""
    from app.security.auth import create_access_token, decode_access_token

    token = create_access_token(data={"sub": "test-user-id"})
    payload = decode_access_token(token)
    assert payload["sub"] == "test-user-id"
    assert "exp" in payload
    assert "iat" in payload


# ── Auth API tests ────────────────────────────────────────────────────

async def test_register_new_user(client: AsyncClient) -> None:
    """POST /api/auth/register should create a user and return 201."""
    email = _unique_email()
    response = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == email
    assert data["role"] == "operator"
    assert "id" in data


async def test_register_duplicate_email(client: AsyncClient) -> None:
    """Registering with an existing email should return 409."""
    email = _unique_email()
    await client.post(
        "/api/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    response = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "anotherpass123"},
    )
    assert response.status_code == 409


async def test_register_short_password(client: AsyncClient) -> None:
    """Password shorter than 8 chars should be rejected."""
    response = await client.post(
        "/api/auth/register",
        json={"email": _unique_email(), "password": "short"},
    )
    assert response.status_code == 422


async def test_login_success(client: AsyncClient) -> None:
    """Correct credentials should return a JWT access token."""
    email = _unique_email()
    await client.post(
        "/api/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    response = await client.post(
        "/api/auth/login",
        json={"email": email, "password": "securepass123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client: AsyncClient) -> None:
    """Wrong password should return 401."""
    email = _unique_email()
    await client.post(
        "/api/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    response = await client.post(
        "/api/auth/login",
        json={"email": email, "password": "wrongpassword"},
    )
    assert response.status_code == 401


async def test_login_nonexistent_user(client: AsyncClient) -> None:
    """Login with non-existent email should return 401."""
    response = await client.post(
        "/api/auth/login",
        json={"email": "nobody@takumiroute.jp", "password": "securepass123"},
    )
    assert response.status_code == 401


async def test_get_me_authenticated(client: AsyncClient) -> None:
    """GET /api/auth/me with valid token should return the user."""
    email = _unique_email()
    await client.post(
        "/api/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    login_resp = await client.post(
        "/api/auth/login",
        json={"email": email, "password": "securepass123"},
    )
    token = login_resp.json()["access_token"]

    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == email


async def test_get_me_no_token(client: AsyncClient) -> None:
    """GET /api/auth/me without a token should return 401/403."""
    response = await client.get("/api/auth/me")
    assert response.status_code in (401, 403)


async def test_get_me_invalid_token(client: AsyncClient) -> None:
    """GET /api/auth/me with a garbage token should return 401."""
    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert response.status_code == 401


# ── Protected endpoint tests ──────────────────────────────────────────

async def test_crud_endpoints_require_auth(client: AsyncClient) -> None:
    """All CRUD endpoints should return 401/403 without auth."""
    endpoints = [
        ("GET", "/api/depots"),
        ("POST", "/api/depots"),
        ("GET", "/api/vehicles"),
        ("POST", "/api/vehicles"),
        ("GET", "/api/stops"),
        ("POST", "/api/stops"),
        ("GET", "/api/orders"),
        ("POST", "/api/orders"),
    ]
    for method, path in endpoints:
        if method == "GET":
            resp = await client.get(path)
        else:
            resp = await client.post(path, json={})
        assert resp.status_code in (401, 403, 422), f"{method} {path} returned {resp.status_code}"
