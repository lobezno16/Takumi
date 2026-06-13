"""CRUD API router for depots."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.depot import Depot
from app.models.user import User
from app.schemas import DepotCreate, DepotResponse
from app.security.deps import get_current_user

router = APIRouter(prefix="/api/depots", tags=["depots"])


def _depot_to_response(depot: Depot) -> dict:
    """Convert a Depot ORM object to a response dict with lat/lon."""
    return {
        "id": depot.id,
        "name": depot.name,
        "latitude": 0.0,  # Will be overridden by query
        "longitude": 0.0,
        "shift_start": depot.shift_start,
        "shift_end": depot.shift_end,
    }


@router.get("", response_model=list[DepotResponse])
async def list_depots(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[dict]:
    """List all depots."""
    result = await db.execute(
        select(
            Depot,
            func.ST_Y(func.ST_GeomFromWKB(Depot.location)).label("lat"),
            func.ST_X(func.ST_GeomFromWKB(Depot.location)).label("lon"),
        )
    )
    rows = result.all()
    return [
        {
            "id": row.Depot.id,
            "name": row.Depot.name,
            "latitude": row.lat,
            "longitude": row.lon,
            "shift_start": row.Depot.shift_start,
            "shift_end": row.Depot.shift_end,
        }
        for row in rows
    ]


@router.post("", response_model=DepotResponse, status_code=201)
async def create_depot(
    body: DepotCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    """Create a new depot."""
    point = func.ST_SetSRID(func.ST_MakePoint(body.longitude, body.latitude), 4326)
    depot = Depot(
        name=body.name,
        location=point,
        shift_start=body.shift_start,
        shift_end=body.shift_end,
    )
    db.add(depot)
    await db.flush()
    await db.refresh(depot)
    return {
        "id": depot.id,
        "name": depot.name,
        "latitude": body.latitude,
        "longitude": body.longitude,
        "shift_start": depot.shift_start,
        "shift_end": depot.shift_end,
    }


@router.get("/{depot_id}", response_model=DepotResponse)
async def get_depot(
    depot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    """Get a depot by ID."""
    result = await db.execute(
        select(
            Depot,
            func.ST_Y(func.ST_GeomFromWKB(Depot.location)).label("lat"),
            func.ST_X(func.ST_GeomFromWKB(Depot.location)).label("lon"),
        ).where(Depot.id == depot_id)
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Depot not found")
    return {
        "id": row.Depot.id,
        "name": row.Depot.name,
        "latitude": row.lat,
        "longitude": row.lon,
        "shift_start": row.Depot.shift_start,
        "shift_end": row.Depot.shift_end,
    }


@router.delete("/{depot_id}", status_code=204)
async def delete_depot(
    depot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> None:
    """Delete a depot by ID."""
    result = await db.execute(select(Depot).where(Depot.id == depot_id))
    depot = result.scalar_one_or_none()
    if depot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Depot not found")
    await db.delete(depot)
