"""API router for route optimization."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.models.user import User
from app.security.deps import get_current_user
from app.services.optimizer.solver import (
    OptResult,
    OptStop,
    OptVehicle,
    solve,
)

router = APIRouter(prefix="/api/optimize", tags=["optimize"])


class StopInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stop_id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    demand: int = Field(default=1, ge=1)
    parcel_size: str = Field(default="60", pattern="^(60|80|100|120)$")
    floor: int | None = Field(default=None, ge=0, le=100)
    address_type: str = Field(default="apartment", pattern="^(apartment|house)$")
    penalty: int = Field(default=5000, ge=0, le=100000)
    time_window_start: int = Field(default=0, ge=0)
    time_window_end: int = Field(default=28800, ge=0)


class VehicleInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vehicle_id: str
    capacity: int = Field(default=80, ge=1)
    max_route_seconds: int = Field(default=28800, ge=1800)
    cost_per_second: float = Field(default=0.01, ge=0)


class OptimizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    depot_latitude: float = Field(ge=-90, le=90)
    depot_longitude: float = Field(ge=-180, le=180)
    stops: list[StopInput] = Field(min_length=1, max_length=500)
    vehicles: list[VehicleInput] = Field(min_length=1, max_length=50)
    time_limit_seconds: int = Field(default=30, ge=1, le=300)


class RouteStopOutput(BaseModel):
    stop_id: str
    stop_index: int
    arrival_seconds: int
    departure_seconds: int
    service_time_seconds: int
    cumulative_load: int


class RouteOutput(BaseModel):
    vehicle_id: str
    vehicle_index: int
    stops: list[RouteStopOutput]
    total_duration_seconds: int
    load: int


class OptimizeResponse(BaseModel):
    status: str
    routes: list[RouteOutput]
    total_distance_seconds: int
    total_stops_visited: int
    total_stops_skipped: int
    objective_value: int
    solver_wall_time_ms: int


@router.post("", response_model=OptimizeResponse)
async def optimize_routes(
    body: OptimizeRequest,
    _user: User = Depends(get_current_user),
) -> OptimizeResponse:
    """Run the prize-collecting VRPTW optimizer.

    Accepts stops with ML-derived penalties and vehicles, returns
    optimized routes that maximize expected successful deliveries.
    """
    opt_stops = [
        OptStop(
            index=i,
            stop_id=s.stop_id,
            latitude=s.latitude,
            longitude=s.longitude,
            demand=s.demand,
            parcel_size=s.parcel_size,
            floor=s.floor,
            address_type=s.address_type,
            penalty=s.penalty,
            time_window_start=s.time_window_start,
            time_window_end=s.time_window_end,
        )
        for i, s in enumerate(body.stops)
    ]

    opt_vehicles = [
        OptVehicle(
            index=i,
            vehicle_id=v.vehicle_id,
            capacity=v.capacity,
            max_route_seconds=v.max_route_seconds,
            cost_per_second=v.cost_per_second,
        )
        for i, v in enumerate(body.vehicles)
    ]

    result = solve(
        depot_lat=body.depot_latitude,
        depot_lon=body.depot_longitude,
        stops=opt_stops,
        vehicles=opt_vehicles,
        time_limit_seconds=body.time_limit_seconds,
    )

    return OptimizeResponse(
        status=result.status,
        routes=[
            RouteOutput(
                vehicle_id=r.vehicle_id,
                vehicle_index=r.vehicle_index,
                stops=[
                    RouteStopOutput(
                        stop_id=s.stop_id,
                        stop_index=s.stop_index,
                        arrival_seconds=s.arrival_seconds,
                        departure_seconds=s.departure_seconds,
                        service_time_seconds=s.service_time_seconds,
                        cumulative_load=s.cumulative_load,
                    )
                    for s in r.stops
                ],
                total_duration_seconds=r.total_duration_seconds,
                load=r.load,
            )
            for r in result.routes
        ],
        total_distance_seconds=result.total_distance_seconds,
        total_stops_visited=result.total_stops_visited,
        total_stops_skipped=result.total_stops_skipped,
        objective_value=result.objective_value,
        solver_wall_time_ms=result.solver_wall_time_ms,
    )
