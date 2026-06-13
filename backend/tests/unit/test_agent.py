"""Tests for Phase 9 — the agentic coordination layer."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from app.models.enums import SlotCode
from app.services.agent.guards import (
    AgentGuardError,
    validate_order_id,
    validate_slot_code,
)
from app.services.agent.intent import parse_intent


# ── Intent parsing (pure, fast) ───────────────────────────────────────

@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("I'm only home after 6pm", SlotCode.T1821),
        ("Please deliver in the evening", SlotCode.T1821),
        ("mornings are best for me", SlotCode.AM),
        ("can you come around noon?", SlotCode.T1214),
        ("afternoon works", SlotCode.T1416),
        ("anytime after 16:00", SlotCode.T1618),
        ("18時以降でお願いします", SlotCode.T1821),
        ("2pm please", SlotCode.T1416),
    ],
)
def test_parse_intent_extracts_slot(message: str, expected: SlotCode) -> None:
    assert parse_intent(message).slot == expected


@pytest.mark.parametrize(
    "message",
    [
        "thanks!",
        "who are you?",
        "the parcel is for my neighbour",
        "",
    ],
)
def test_parse_intent_no_time_signal_returns_none(message: str) -> None:
    assert parse_intent(message).slot is None


# ── Guards (pure, fast) ───────────────────────────────────────────────

def test_validate_slot_code_accepts_enum_values() -> None:
    assert validate_slot_code("t1821") == SlotCode.T1821


@pytest.mark.parametrize("bad", ["evening", "DROP TABLE slots", "", "t9999"])
def test_validate_slot_code_rejects_junk(bad: str) -> None:
    with pytest.raises(AgentGuardError):
        validate_slot_code(bad)


def test_validate_order_id_rejects_non_uuid() -> None:
    with pytest.raises(AgentGuardError):
        validate_order_id("'; DROP TABLE orders;--")


def test_validate_order_id_accepts_uuid() -> None:
    oid = uuid.uuid4()
    assert validate_order_id(str(oid)) == oid


# ── Integration: confirm flow + audit trail ───────────────────────────

async def _auth_headers(client: AsyncClient) -> dict[str, str]:
    email = f"agent-{uuid.uuid4().hex[:8]}@test.local"
    pw = "Sup3rSecret!pw9"
    await client.post("/api/auth/register", json={"email": email, "password": pw})
    r = await client.post("/api/auth/login", json={"email": email, "password": pw})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def test_recipient_message_confirms_window_and_logs(client: AsyncClient) -> None:
    """'home after 6pm' → confirm_delivery(t1821), order updated, audit logged."""
    headers = await _auth_headers(client)

    session = await client.post(
        "/api/agent/session", headers=headers, json={"n_orders": 1}
    )
    assert session.status_code == 201
    order_id = session.json()["orders"][0]["order_id"]

    msg = await client.post(
        "/api/agent/message",
        headers=headers,
        json={"order_id": order_id, "message": "I'm only home after 6pm"},
    )
    assert msg.status_code == 200
    body = msg.json()
    assert body["action"] == "confirm_delivery"
    assert body["confirmed_slot"] == "t1821"

    audit = await client.get(f"/api/agent/interactions/{order_id}", headers=headers)
    directions = [i["direction"] for i in audit.json()]
    actions = [i["action_taken"] for i in audit.json()]
    assert "in" in directions and "out" in directions
    assert "confirm_delivery" in actions
