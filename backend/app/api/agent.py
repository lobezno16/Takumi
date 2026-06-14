"""API router for the agentic coordination layer (mock LINE channel).

Exposes a constrained surface: seed a coordination session, deliver an inbound
recipient message to the constrained loop, trigger a replan, and read the
audit trail. All recipient text is treated as untrusted data (§13.10).
"""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.agent_interaction import AgentInteraction
from app.models.enums import AddressType, OrderStatus, ParcelSize
from app.models.order import Order
from app.models.stop import Stop
from app.models.user import User
from app.security.deps import get_current_user
from app.security.ratelimit import limiter
from app.services.agent import tools
from app.services.agent.guards import AgentGuardError
from app.services.agent.loop import handle_message
from app.services.cache import get_redis
from app.services.ml.predict import predict_candidate_slots
from app.synthetic.generator import generate_stops

router = APIRouter(prefix="/api/agent", tags=["agent"])

_SESSION_TTL_SECONDS = 3600


class SessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    n_orders: int = Field(default=6, ge=1, le=20)
    day_of_week: int = Field(default=2, ge=0, le=6)
    seed: int | None = Field(default=None, ge=0, le=2**31)


class OrderSummary(BaseModel):
    order_id: str
    address: str
    address_type: str
    floor: int | None
    assigned_slot: str | None
    best_slot: str
    best_prob: float


class SessionResponse(BaseModel):
    session_id: str
    day_of_week: int
    orders: list[OrderSummary]


class MessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    order_id: str = Field(min_length=1, max_length=64)
    # Untrusted recipient text — bounded length, never executed.
    message: str = Field(min_length=1, max_length=1000)
    day_of_week: int = Field(default=2, ge=0, le=6)


class MessageResponse(BaseModel):
    order_id: str
    action: str
    reply: str
    confirmed_slot: str | None


class ReplanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1, max_length=64)
    reason_code: str = Field(
        default="manual",
        pattern="^(recipient_unavailable|window_changed|traffic|manual)$",
    )


class InteractionItem(BaseModel):
    id: str
    direction: str
    raw_message: str
    action_taken: str | None
    created_at: str


@router.post("/session", response_model=SessionResponse, status_code=201)
@limiter.limit(settings.RATE_LIMIT_EXPENSIVE)
async def create_session(
    request: Request,
    body: SessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    """Seed a small delivery batch (stops + orders) for agent coordination."""
    seed = body.seed if body.seed is not None else uuid.uuid4().int % (2**31)
    synth = generate_stops(n_stops=body.n_orders, seed=seed)
    org_id = current_user.organization_id

    summaries: list[OrderSummary] = []
    order_ids: list[str] = []
    for s in synth:
        point = func.ST_SetSRID(func.ST_MakePoint(s["longitude"], s["latitude"]), 4326)
        stop = Stop(
            organization_id=org_id,
            address=s["address"],
            location=point,
            address_type=AddressType(s["address_type"]),
            floor=s["floor"],
        )
        db.add(stop)
        await db.flush()

        order = Order(
            organization_id=org_id,
            stop_id=stop.id,
            parcel_size=ParcelSize.S80,
            demand=1,
            status=OrderStatus.PENDING,
        )
        db.add(order)
        await db.flush()
        order_ids.append(str(order.id))

        candidates = await predict_candidate_slots(
            stop={
                "id": str(stop.id),
                "address_type": stop.address_type.value,
                "floor": stop.floor,
            },
            day_of_week=body.day_of_week,
            history=[],
        )
        best = candidates[0]
        summaries.append(
            OrderSummary(
                order_id=str(order.id),
                address=stop.address,
                address_type=stop.address_type.value,
                floor=stop.floor,
                assigned_slot=order.assigned_slot_code,
                best_slot=best["slot_code"],
                best_prob=best["predicted_prob"],
            )
        )

    session_id = str(uuid.uuid4())
    redis = await get_redis()
    await redis.set(
        f"takumi:agent:session:{session_id}",
        json.dumps(order_ids),
        ex=_SESSION_TTL_SECONDS,
    )
    return SessionResponse(
        session_id=session_id,
        day_of_week=body.day_of_week,
        orders=summaries,
    )


@router.post("/message", response_model=MessageResponse)
@limiter.limit(settings.RATE_LIMIT_EXPENSIVE)
async def post_message(
    request: Request,
    body: MessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    """Deliver an inbound recipient message to the constrained agent loop."""
    try:
        result = await handle_message(
            db,
            body.order_id,
            body.message,
            current_user.organization_id,
            body.day_of_week,
        )
    except AgentGuardError as exc:
        # Generic client error; details stay in server logs (§13.15).
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not process message for this order.",
        ) from exc

    confirmed = result.detail.get("confirmed_slot") if result.detail else None
    return MessageResponse(
        order_id=result.order_id,
        action=result.action.value,
        reply=result.reply,
        confirmed_slot=confirmed,
    )


@router.post("/replan")
@limiter.limit(settings.RATE_LIMIT_EXPENSIVE)
async def post_replan(
    request: Request,
    body: ReplanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    """Trigger a re-optimization for a session and push it over the WebSocket."""
    try:
        session_id = uuid.UUID(body.session_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session id."
        ) from exc
    try:
        return await tools.request_replan(
            db, session_id, body.reason_code, current_user.organization_id
        )
    except AgentGuardError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not replan this session.",
        ) from exc


@router.get("/interactions/{order_id}", response_model=list[InteractionItem])
async def list_interactions(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InteractionItem]:
    """Return the audit trail for one of the caller's orders."""
    result = await db.execute(
        select(AgentInteraction)
        .join(Order, AgentInteraction.order_id == Order.id)
        .where(
            AgentInteraction.order_id == order_id,
            Order.organization_id == current_user.organization_id,
        )
        .order_by(AgentInteraction.created_at)
    )
    return [
        InteractionItem(
            id=str(i.id),
            direction=i.direction.value,
            raw_message=i.raw_message,
            action_taken=i.action_taken.value if i.action_taken else None,
            created_at=i.created_at.isoformat(),
        )
        for i in result.scalars().all()
    ]
