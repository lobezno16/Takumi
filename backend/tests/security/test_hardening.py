"""Security tests (§13) — input validation, SQL safety, PII, headers, errors."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from starlette.requests import Request

from app.main import app, unhandled_exception_handler
from app.observability import configure_logging, get_logger, scrub_pii

APP_DIR = Path(__file__).resolve().parents[2] / "app"

# Flags string-interpolated SQL — f-strings/% applied to execute()/text().
_INTERP_SQL = re.compile(
    r"(execute|text)\s*\(\s*[fF]['\"]"
    r"|[fF]['\"][^'\"]*\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b",
)


def test_no_string_interpolated_sql() -> None:
    """§13.5 — all SQL must use the ORM / bound params, never interpolation."""
    offenders: list[str] = []
    for path in APP_DIR.rglob("*.py"):
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if _INTERP_SQL.search(line):
                offenders.append(f"{path.name}:{n}: {line.strip()}")
    assert not offenders, "string-interpolated SQL found:\n" + "\n".join(offenders)


def test_pii_scrub_processor_redacts_sensitive_keys() -> None:
    """§13.9 — the structlog processor redacts PII/secret keys recursively."""
    event = {
        "event": "agent_action",
        "email": "alice@example.com",
        "address": "東京都江東区3丁目",
        "nested": {"raw_message": "I'm home after 6pm", "ok": "keep"},
        "count": 3,
    }
    scrubbed = scrub_pii(None, "info", event)
    assert scrubbed["email"] == "[REDACTED]"
    assert scrubbed["address"] == "[REDACTED]"
    assert scrubbed["nested"]["raw_message"] == "[REDACTED]"
    assert scrubbed["nested"]["ok"] == "keep"
    assert scrubbed["count"] == 3


def test_pii_absent_from_rendered_logs(capsys: pytest.CaptureFixture[str]) -> None:
    """§13.9 — addresses/emails never appear in emitted log output."""
    configure_logging()
    get_logger("test.pii").info(
        "delivery", address="東京都江東区3丁目15-13", email="bob@example.com"
    )
    out = capsys.readouterr()
    combined = out.out + out.err
    assert "bob@example.com" not in combined
    assert "江東区3丁目15-13" not in combined
    assert "[REDACTED]" in combined


async def test_generic_500_handler_hides_internals() -> None:
    """§13.15 — the global handler returns a generic message, not a traceback."""
    scope = {"type": "http", "method": "GET", "path": "/x", "headers": []}
    request = Request(scope)
    response = await unhandled_exception_handler(
        request, ValueError("secret internal detail: db password leaked")
    )
    assert response.status_code == 500
    assert b"secret internal detail" not in response.body
    assert b"Internal server error" in response.body


async def test_security_headers_present() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t") as ac:
        r = await ac.get("/health")
    for header in (
        "content-security-policy",
        "x-content-type-options",
        "x-frame-options",
        "referrer-policy",
        "permissions-policy",
    ):
        assert header in {k.lower() for k in r.headers}


async def test_oversized_body_rejected() -> None:
    """§13.4 — a body over the configured limit is rejected with 413."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t") as ac:
        r = await ac.post(
            "/api/auth/login",
            content=b"x" * 10,
            headers={"content-type": "application/json", "content-length": "2000000"},
        )
    assert r.status_code == 413


async def test_protected_endpoint_requires_auth() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t") as ac:
        r = await ac.post("/api/agent/session", json={"n_orders": 1, "day_of_week": 2})
    assert r.status_code in (401, 403)


async def test_refresh_token_cannot_be_used_as_access_token() -> None:
    """§13.2 — token ``type`` claim is enforced; a refresh token is not access."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t") as ac:
        email = f"tok-{uuid.uuid4().hex[:8]}@test.local"
        pw = "Sup3rSecret!pw9"
        await ac.post("/api/auth/register", json={"email": email, "password": pw})
        tokens = (
            await ac.post("/api/auth/login", json={"email": email, "password": pw})
        ).json()
        r = await ac.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {tokens['refresh_token']}"},
        )
    assert r.status_code == 401
