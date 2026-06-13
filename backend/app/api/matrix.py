"""API router for travel-time matrix and OSRM-related endpoints."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.services.matrix import (
    Coordinate,
    check_osrm_health,
    get_travel_time_matrix,
)

router = APIRouter(prefix="/api/matrix", tags=["matrix"])


class CoordinateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lon: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)


class MatrixRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    coordinates: list[CoordinateInput] = Field(min_length=2, max_length=100)
    sources: list[int] | None = None
    destinations: list[int] | None = None


class MatrixResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    durations: list[list[float | None]]
    distances: list[list[float | None]]
    sources: list[dict[str, Any]]
    destinations: list[dict[str, Any]]


@router.post("", response_model=MatrixResponse)
async def compute_matrix(request: MatrixRequest) -> MatrixResponse:
    """Compute an NxN travel-time/distance matrix via OSRM.

    Accepts a list of coordinates and returns a matrix of durations (seconds)
    and distances (meters) between all pairs.
    """
    coords = [Coordinate(lon=c.lon, lat=c.lat) for c in request.coordinates]

    try:
        result = await get_travel_time_matrix(
            coords,
            sources=request.sources,
            destinations=request.destinations,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail="OSRM service unavailable"
        ) from exc

    return MatrixResponse(
        durations=result.durations,
        distances=result.distances,
        sources=result.sources,
        destinations=result.destinations,
    )


@router.get("/health")
async def osrm_health() -> dict[str, str]:
    """Check OSRM service connectivity."""
    healthy = await check_osrm_health()
    if not healthy:
        raise HTTPException(
            status_code=503,
            detail="OSRM service is not available. Run the routing profile first.",
        )
    return {"status": "ok", "service": "osrm"}
