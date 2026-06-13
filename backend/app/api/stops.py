"""CRUD API router for stops."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.stop import Stop
from app.models.user import User
from app.schemas import StopCreate, StopResponse
from app.security.deps import get_current_user

router = APIRouter(prefix="/api/stops", tags=["stops"])


@router.get("", response_model=list[StopResponse])
async def list_stops(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[Stop]:
    """List stops with bounded pagination (§13.4)."""
    result = await db.execute(select(Stop).limit(limit).offset(offset))
    return list(result.scalars().all())


@router.post("", response_model=StopResponse, status_code=201)
async def create_stop(
    body: StopCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Stop:
    """Create a new delivery stop."""
    point = func.ST_SetSRID(func.ST_MakePoint(body.longitude, body.latitude), 4326)
    stop = Stop(
        address=body.address,
        location=point,
        address_type=body.address_type,
        floor=body.floor,
    )
    db.add(stop)
    await db.flush()
    await db.refresh(stop)
    return stop


@router.get("/{stop_id}", response_model=StopResponse)
async def get_stop(
    stop_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Stop:
    """Get a stop by ID."""
    result = await db.execute(select(Stop).where(Stop.id == stop_id))
    stop = result.scalar_one_or_none()
    if stop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found")
    return stop


@router.delete("/{stop_id}", status_code=204)
async def delete_stop(
    stop_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> None:
    """Delete a stop by ID."""
    result = await db.execute(select(Stop).where(Stop.id == stop_id))
    stop = result.scalar_one_or_none()
    if stop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found")
    await db.delete(stop)
