"""Guards for the agentic coordination layer.

Security rationale (§13.10): the agent may only take *allowlisted* actions
with *validated* arguments, and is rate-capped per order. Every side-effecting
path goes through these checks. Anything off-allowlist is rejected and flagged.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_interaction import AgentInteraction
from app.models.enums import AgentAction, SlotCode

# The only actions the agent may ever take. Kept as an explicit set so an
# accidental new enum value cannot silently become executable.
ALLOWED_ACTIONS: frozenset[AgentAction] = frozenset(
    {
        AgentAction.PROPOSE_WINDOW,
        AgentAction.CONFIRM_DELIVERY,
        AgentAction.REQUEST_REPLAN,
        AgentAction.NO_ACTION,
    }
)

# Hard cap on agent actions per order to bound runaway/abusive interaction.
MAX_ACTIONS_PER_ORDER = 8


class AgentGuardError(Exception):
    """Raised when a guard rejects an action or argument."""


def assert_action_allowed(action: AgentAction) -> None:
    """Reject any action that is not on the allowlist."""
    if action not in ALLOWED_ACTIONS:
        raise AgentGuardError(f"action not allowlisted: {action!r}")


def validate_slot_code(value: str) -> SlotCode:
    """Coerce an arbitrary string to a SlotCode enum, or reject it.

    Never trust a slot string that originated from recipient text — it must
    map exactly to an enumerated window.
    """
    try:
        return SlotCode(value)
    except ValueError as exc:
        raise AgentGuardError(f"invalid slot code: {value!r}") from exc


def validate_order_id(value: str | uuid.UUID) -> uuid.UUID:
    """Coerce an order identifier to a UUID, or reject it."""
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError) as exc:
        raise AgentGuardError(f"invalid order id: {value!r}") from exc


async def assert_under_action_cap(db: AsyncSession, order_id: uuid.UUID) -> None:
    """Reject further agent actions once an order hits the interaction cap."""
    result = await db.execute(
        select(func.count())
        .select_from(AgentInteraction)
        .where(AgentInteraction.order_id == order_id)
    )
    count = result.scalar_one()
    if count >= MAX_ACTIONS_PER_ORDER:
        raise AgentGuardError(
            f"order {order_id} exceeded action cap ({MAX_ACTIONS_PER_ORDER})"
        )
