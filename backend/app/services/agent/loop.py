"""The constrained tool-use loop for recipient coordination.

This is NOT a chatbot. On an inbound recipient message it:
  1. validates the target order and the per-order action cap (guards),
  2. parses the message into an optional requested slot (intent — the only
     interpretation of untrusted text),
  3. selects exactly one allowlisted action with validated arguments,
  4. executes the corresponding tool, and
  5. writes both the inbound message and the agent's reply to the
     ``agent_interactions`` audit trail.

Security rationale (§13.10): the decision in step 3 depends only on the
enumerated ``SlotCode | None`` from step 2 — never on the raw text — so a
prompt-injection message simply yields ``None`` and a ``NO_ACTION`` outcome.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_interaction import AgentInteraction
from app.models.enums import AgentAction, AgentDirection, SlotCode
from app.services.agent import tools
from app.services.agent.guards import (
    assert_action_allowed,
    assert_under_action_cap,
    validate_order_id,
)
from app.services.agent.intent import parse_intent

_SLOT_LABELS: dict[SlotCode, str] = {
    SlotCode.AM: "morning (until 12:00)",
    SlotCode.T1214: "12:00–14:00",
    SlotCode.T1416: "14:00–16:00",
    SlotCode.T1618: "16:00–18:00",
    SlotCode.T1821: "evening (18:00–21:00)",
}


@dataclass
class AgentResult:
    """Outcome of one turn of the loop."""

    order_id: str
    action: AgentAction
    reply: str
    detail: dict[str, Any] | None


async def _log(
    db: AsyncSession,
    order_id: uuid.UUID,
    direction: AgentDirection,
    message: str,
    parsed_intent: dict[str, Any] | None,
    action: AgentAction | None,
) -> None:
    db.add(
        AgentInteraction(
            order_id=order_id,
            channel="line",
            direction=direction,
            raw_message=message,
            parsed_intent=parsed_intent,
            action_taken=action,
        )
    )
    await db.flush()


async def handle_message(
    db: AsyncSession,
    order_id_raw: str | uuid.UUID,
    message: str,
    day_of_week: int = 2,
) -> AgentResult:
    """Process one inbound recipient message under full guard enforcement."""
    order_id = validate_order_id(order_id_raw)
    await assert_under_action_cap(db, order_id)

    intent = parse_intent(message)
    intent_json: dict[str, Any] = {
        "slot": intent.slot.value if intent.slot else None,
        "matched_text": intent.matched_text,
    }
    # Audit the untrusted inbound message verbatim (stored as data only).
    await _log(db, order_id, AgentDirection.IN, message, intent_json, None)

    if intent.slot is not None:
        action = AgentAction.CONFIRM_DELIVERY
        assert_action_allowed(action)
        detail = await tools.confirm_delivery(db, order_id, intent.slot)
        reply = (
            f"Thanks! We've locked your delivery to the "
            f"{_SLOT_LABELS[intent.slot]} window. See you then."
        )
    else:
        action = AgentAction.NO_ACTION
        assert_action_allowed(action)
        detail = None
        reply = (
            "Thanks for your message. Which window works best — morning, "
            "afternoon, or evening? We'll schedule your delivery accordingly."
        )

    await _log(db, order_id, AgentDirection.OUT, reply, intent_json, action)
    return AgentResult(
        order_id=str(order_id),
        action=action,
        reply=reply,
        detail=detail,
    )
