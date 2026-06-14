"""CRUD API router for orders (organization-scoped)."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.order import Order
from app.models.stop import Stop
from app.models.user import User
from app.schemas import OrderCreate, OrderResponse, OrderStatusUpdate
from app.security.deps import get_current_user

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("", response_model=list[OrderResponse])
async def list_orders(
    stop_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Order]:
    """List this organization's orders, optionally filtered by stop."""
    query = select(Order).where(Order.organization_id == current_user.organization_id)
    if stop_id is not None:
        query = query.where(Order.stop_id == stop_id)
    result = await db.execute(query.order_by(Order.created_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=OrderResponse, status_code=201)
async def create_order(
    body: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Order:
    """Create a new delivery order against one of the caller's stops."""
    # The stop must belong to the caller's organization (no cross-tenant attach).
    stop = await db.execute(
        select(Stop.id).where(
            Stop.id == body.stop_id,
            Stop.organization_id == current_user.organization_id,
        )
    )
    if stop.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found"
        )
    order = Order(
        organization_id=current_user.organization_id,
        stop_id=body.stop_id,
        parcel_size=body.parcel_size,
        demand=body.demand,
    )
    db.add(order)
    await db.flush()
    await db.refresh(order)
    return order


@router.get("/slots", response_model=list[dict[str, Any]])
async def list_slots(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """List all available delivery time slots (shared reference data)."""
    from app.models.slot import Slot

    result = await db.execute(select(Slot).order_by(Slot.start_min))
    slots = result.scalars().all()
    return [
        {"code": s.code, "start_min": s.start_min, "end_min": s.end_min} for s in slots
    ]


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Order:
    """Get one of the caller's orders by ID."""
    result = await db.execute(
        select(Order).where(
            Order.id == order_id,
            Order.organization_id == current_user.organization_id,
        )
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )
    return order


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: uuid.UUID,
    body: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Order:
    """Update the status of one of the caller's orders."""
    result = await db.execute(
        select(Order).where(
            Order.id == order_id,
            Order.organization_id == current_user.organization_id,
        )
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )
    order.status = body.status
    await db.flush()
    await db.refresh(order)
    return order
