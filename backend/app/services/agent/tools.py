"""Allowlisted, side-effecting tools for the agentic coordination layer.

Security rationale (§13.10): these are the ONLY actions the agent can take.
Every tool validates its arguments (UUIDs, enums, allowlisted reason codes)
before touching the database, Redis, or the WebSocket. No tool accepts free
text, so untrusted recipient input can never reach a destructive operation.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from geoalchemy2 import Geometry
from sqlalchemy import cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import OrderStatus, SlotCode
from app.models.order import Order
from app.models.stop import Stop
from app.services.agent.guards import AgentGuardError
from app.services.cache import get_redis
from app.services.ml.predict import predict_candidate_slots
from app.services.optimizer.solver import OptStop, OptVehicle, solve

# Allowlisted machine reason codes for a replan request — never free text.
REPLAN_REASONS: frozenset[str] = frozenset(
    {
        "recipient_unavailable",
        "window_changed",
        "traffic",
        "manual",
    }
)

_DEPOT_LAT, _DEPOT_LON = 35.672, 139.817


async def _load_order_with_coords(
    db: AsyncSession, order_id: uuid.UUID, organization_id: uuid.UUID
) -> tuple[Order, Stop, float, float]:
    """Load a caller-owned order, its stop, and coordinates, or raise.

    Scoping by ``organization_id`` enforces tenant isolation: an order in
    another organization is indistinguishable from one that does not exist.
    """
    result = await db.execute(
        select(
            Order,
            Stop,
            func.ST_Y(cast(Stop.location, Geometry)),
            func.ST_X(cast(Stop.location, Geometry)),
        )
        .join(Stop, Order.stop_id == Stop.id)
        .where(Order.id == order_id, Order.organization_id == organization_id)
    )
    row = result.first()
    if row is None:
        raise AgentGuardError(f"order not found: {order_id}")
    order, stop, lat, lon = row
    return order, stop, float(lat), float(lon)


async def load_order_for_org(
    db: AsyncSession, order_id: uuid.UUID, organization_id: uuid.UUID
) -> None:
    """Assert an order exists and belongs to the organization, else raise."""
    await _load_order_with_coords(db, order_id, organization_id)


async def get_candidate_slots(
    db: AsyncSession,
    order_id: uuid.UUID,
    organization_id: uuid.UUID,
    day_of_week: int = 2,
) -> dict[str, Any]:
    """Return ML-ranked candidate slots for an order's recipient."""
    _order, stop, _lat, _lon = await _load_order_with_coords(
        db, order_id, organization_id
    )
    candidates = await predict_candidate_slots(
        stop={
            "id": str(stop.id),
            "address_type": stop.address_type.value,
            "floor": stop.floor,
        },
        day_of_week=day_of_week,
        history=[],
    )
    return {
        "order_id": str(order_id),
        "candidates": candidates,
        "best_slot": candidates[0]["slot_code"],
    }


async def propose_window(
    db: AsyncSession, order_id: uuid.UUID, slot: SlotCode, organization_id: uuid.UUID
) -> dict[str, Any]:
    """Record a proposed window for the recipient (no state change)."""
    await _load_order_with_coords(db, order_id, organization_id)  # validates ownership
    return {
        "order_id": str(order_id),
        "proposed_slot": slot.value,
        "status": "proposed",
    }


async def confirm_delivery(
    db: AsyncSession, order_id: uuid.UUID, slot: SlotCode, organization_id: uuid.UUID
) -> dict[str, Any]:
    """Lock the recipient-confirmed delivery window onto the order."""
    order, _stop, _lat, _lon = await _load_order_with_coords(
        db, order_id, organization_id
    )
    order.assigned_slot_code = slot.value
    order.status = OrderStatus.ASSIGNED
    await db.flush()
    return {
        "order_id": str(order_id),
        "confirmed_slot": slot.value,
        "status": order.status.value,
    }


async def request_replan(
    db: AsyncSession,
    session_id: uuid.UUID,
    reason_code: str,
    organization_id: uuid.UUID,
) -> dict[str, Any]:
    """Enqueue and run a re-optimization for a session's orders, then push the
    new route to connected clients over the WebSocket.

    ``session_id`` plays the role of the routing batch identifier (§10's
    ``route_id``); ``reason_code`` must be allowlisted. Re-solving is scoped to
    the caller's organization so a session id cannot pull another tenant's data.
    """
    if reason_code not in REPLAN_REASONS:
        raise AgentGuardError(f"invalid replan reason: {reason_code!r}")

    redis = await get_redis()
    order_ids_raw = await redis.get(f"takumi:agent:session:{session_id}")
    if not order_ids_raw:
        raise AgentGuardError(f"unknown agent session: {session_id}")
    order_ids = [uuid.UUID(x) for x in json.loads(order_ids_raw)]

    # Enqueue the job for auditability (§10 Redis replan queue).
    await redis.lpush(  # type: ignore[misc]
        "takumi:replan",
        json.dumps({"session_id": str(session_id), "reason": reason_code}),
    )

    # Re-solve over the session's stops (org-scoped) using ML-derived penalties.
    rows = await db.execute(
        select(
            Order,
            Stop,
            func.ST_Y(cast(Stop.location, Geometry)),
            func.ST_X(cast(Stop.location, Geometry)),
        )
        .join(Stop, Order.stop_id == Stop.id)
        .where(
            Order.id.in_(order_ids),
            Order.organization_id == organization_id,
        )
    )
    opt_stops: list[OptStop] = []
    for i, (order, stop, lat, lon) in enumerate(rows.all()):
        # Confirmed windows are high-confidence: they earn the top penalty.
        penalty = 10000 if order.status == OrderStatus.ASSIGNED else 5000
        opt_stops.append(
            OptStop(
                index=i,
                stop_id=str(order.id),
                latitude=float(lat),
                longitude=float(lon),
                demand=order.demand,
                parcel_size=order.parcel_size.value,
                floor=stop.floor,
                address_type=stop.address_type.value,
                penalty=penalty,
            )
        )

    vehicles = [
        OptVehicle(index=v, vehicle_id=f"v-{v}", capacity=max(20, len(opt_stops)))
        for v in range(max(1, len(opt_stops) // 20 + 1))
    ]
    result = solve(_DEPOT_LAT, _DEPOT_LON, opt_stops, vehicles, time_limit_seconds=5)

    payload = {
        "session_id": str(session_id),
        "reason": reason_code,
        "status": result.status,
        "vehicles_used": len(result.routes),
        "stops_visited": result.total_stops_visited,
        "total_seconds": result.total_distance_seconds,
    }
    # Deferred import avoids a circular import with the API layer.
    from app.api.ws import broadcast

    await broadcast("route_update", payload)
    return payload
