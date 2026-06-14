"""Security tests (§13.3) — tenant isolation across organizations.

Each registration provisions its own organization. These tests prove a user
in organization A can never read or act on organization B's data: cross-tenant
reads return 404, list endpoints only show own-org rows, and the agent refuses
to act on another tenant's order.
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient


async def _register_org(client: AsyncClient) -> dict[str, str]:
    """Register a fresh user (→ a fresh organization) and return auth headers."""
    email = f"tenant-{uuid.uuid4().hex[:8]}@test.local"
    pw = "Sup3rSecret!pw9"
    await client.post("/api/auth/register", json={"email": email, "password": pw})
    token = (
        await client.post("/api/auth/login", json={"email": email, "password": pw})
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_registration_creates_isolated_org(client: AsyncClient) -> None:
    """Two registrations land in two distinct organizations."""
    me_a = await client.get("/api/auth/me", headers=await _register_org(client))
    me_b = await client.get("/api/auth/me", headers=await _register_org(client))
    assert me_a.status_code == 200
    assert me_b.status_code == 200
    assert me_a.json()["organization_id"] != me_b.json()["organization_id"]


async def test_cross_tenant_stop_is_not_readable(client: AsyncClient) -> None:
    headers_a = await _register_org(client)
    headers_b = await _register_org(client)

    created = await client.post(
        "/api/stops",
        headers=headers_a,
        json={
            "address": "Tokyo 1-2-3",
            "latitude": 35.67,
            "longitude": 139.82,
            "address_type": "apartment",
            "floor": 3,
        },
    )
    assert created.status_code == 201
    stop_id = created.json()["id"]

    # Owner can read it.
    assert (
        await client.get(f"/api/stops/{stop_id}", headers=headers_a)
    ).status_code == 200

    # Another tenant cannot — indistinguishable from non-existent.
    assert (
        await client.get(f"/api/stops/{stop_id}", headers=headers_b)
    ).status_code == 404

    # And it never appears in the other tenant's list.
    listed_b = (await client.get("/api/stops", headers=headers_b)).json()
    assert all(s["id"] != stop_id for s in listed_b)


async def test_agent_cannot_act_on_another_tenants_order(client: AsyncClient) -> None:
    headers_a = await _register_org(client)
    headers_b = await _register_org(client)

    session = await client.post(
        "/api/agent/session", headers=headers_a, json={"n_orders": 1}
    )
    order_id = session.json()["orders"][0]["order_id"]

    # Tenant B may not message tenant A's order …
    msg = await client.post(
        "/api/agent/message",
        headers=headers_b,
        json={"order_id": order_id, "message": "evening please"},
    )
    assert msg.status_code == 400

    # … nor read its audit trail.
    audit_b = await client.get(f"/api/agent/interactions/{order_id}", headers=headers_b)
    assert audit_b.json() == []

    # Tenant A still can.
    ok = await client.post(
        "/api/agent/message",
        headers=headers_a,
        json={"order_id": order_id, "message": "I'm only home after 6pm"},
    )
    assert ok.status_code == 200
    assert ok.json()["confirmed_slot"] == "t1821"
