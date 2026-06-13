"""API router for simulation runs."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from app.models.user import User
from app.security.deps import get_current_user
from app.services.simulation.engine import run_monte_carlo, run_simulation

router = APIRouter(prefix="/api/simulation", tags=["simulation"])


class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    n_stops: int = Field(default=50, ge=5, le=200)
    n_vehicles: int = Field(default=3, ge=1, le=20)
    # Baseline's fixed default window; Takumi auto-selects the best slot per stop.
    slot_code: str = Field(default="am", pattern="^(am|t1214|t1416|t1618|t1821)$")
    day_of_week: int = Field(default=2, ge=0, le=6)
    seed: int | None = None


class KPIsOutput(BaseModel):
    total_stops: int
    stops_attempted: int
    stops_skipped: int
    deliveries_successful: int
    deliveries_failed: int
    first_attempt_success_rate: float
    redelivery_rate: float
    total_route_time_seconds: int
    avg_route_time_seconds: float
    total_vehicles_used: int
    cost_estimate: float


class SimulationResponse(BaseModel):
    run_id: str
    ward: str
    seed: int
    n_stops: int
    n_vehicles: int
    slot_code: str
    day_of_week: int
    baseline: KPIsOutput
    takumi: KPIsOutput
    improvement_pct: float
    solver_time_ms: int


class RouteStopDetailOutput(BaseModel):
    stop_id: str
    latitude: float
    longitude: float
    sequence: int
    arrival_min: int
    assigned_slot: str
    predicted_prob: float
    outcome: str


class RouteDetailOutput(BaseModel):
    vehicle_id: str
    vehicle_index: int
    stops: list[RouteStopDetailOutput]
    duration_min: int
    load: int


class DetailedSimulationResponse(BaseModel):
    run_id: str
    ward: str
    seed: int
    n_stops: int
    n_vehicles: int
    slot_code: str
    day_of_week: int
    depot_lat: float
    depot_lon: float
    baseline: KPIsOutput
    takumi: KPIsOutput
    improvement_pct: float
    solver_time_ms: int
    baseline_routes: list[RouteDetailOutput]
    takumi_routes: list[RouteDetailOutput]


class MonteCarloRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    n_runs: int = Field(default=5, ge=1, le=50)
    n_stops: int = Field(default=30, ge=5, le=100)
    n_vehicles: int = Field(default=3, ge=1, le=10)
    slot_code: str = Field(default="am", pattern="^(am|t1214|t1416|t1618|t1821)$")
    base_seed: int = Field(default=42)


class MonteCarloResponse(BaseModel):
    n_runs: int
    avg_baseline_redelivery_rate: float
    avg_takumi_redelivery_rate: float
    avg_improvement_pct: float
    avg_baseline_cost: float
    avg_takumi_cost: float
    cost_savings_pct: float
    runs: list[dict[str, Any]]


@router.post("/run", response_model=SimulationResponse)
async def run_single_simulation(
    body: SimulationRequest,
    _user: User = Depends(get_current_user),
) -> SimulationResponse:
    """Run a single baseline vs Takumi simulation."""
    result = await run_simulation(
        n_stops=body.n_stops,
        n_vehicles=body.n_vehicles,
        slot_code=body.slot_code,
        day_of_week=body.day_of_week,
        seed=body.seed,
    )
    return SimulationResponse(
        run_id=result.run_id,
        ward=result.ward,
        seed=result.seed,
        n_stops=result.n_stops,
        n_vehicles=result.n_vehicles,
        slot_code=result.slot_code,
        day_of_week=result.day_of_week,
        baseline=KPIsOutput(**result.baseline.__dict__),
        takumi=KPIsOutput(**result.takumi.__dict__),
        improvement_pct=result.improvement_pct,
        solver_time_ms=result.solver_time_ms,
    )


def _route_detail_to_output(routes: Any) -> list[RouteDetailOutput]:
    """Map engine RouteDetail dataclasses to API output schemas."""
    return [
        RouteDetailOutput(
            vehicle_id=r.vehicle_id,
            vehicle_index=r.vehicle_index,
            stops=[RouteStopDetailOutput(**s.__dict__) for s in r.stops],
            duration_min=r.duration_min,
            load=r.load,
        )
        for r in routes
    ]


@router.post("/run-detailed", response_model=DetailedSimulationResponse)
async def run_detailed_simulation(
    body: SimulationRequest,
    _user: User = Depends(get_current_user),
) -> DetailedSimulationResponse:
    """Run a simulation and return full route geometry for the live map."""
    result = await run_simulation(
        n_stops=body.n_stops,
        n_vehicles=body.n_vehicles,
        slot_code=body.slot_code,
        day_of_week=body.day_of_week,
        seed=body.seed,
        detailed=True,
    )
    return DetailedSimulationResponse(
        run_id=result.run_id,
        ward=result.ward,
        seed=result.seed,
        n_stops=result.n_stops,
        n_vehicles=result.n_vehicles,
        slot_code=result.slot_code,
        day_of_week=result.day_of_week,
        depot_lat=result.depot_lat,
        depot_lon=result.depot_lon,
        baseline=KPIsOutput(**result.baseline.__dict__),
        takumi=KPIsOutput(**result.takumi.__dict__),
        improvement_pct=result.improvement_pct,
        solver_time_ms=result.solver_time_ms,
        baseline_routes=_route_detail_to_output(result.baseline_routes),
        takumi_routes=_route_detail_to_output(result.takumi_routes),
    )


@router.post("/monte-carlo", response_model=MonteCarloResponse)
async def run_monte_carlo_endpoint(
    body: MonteCarloRequest,
    _user: User = Depends(get_current_user),
) -> MonteCarloResponse:
    """Run Monte Carlo simulation (multiple runs) and return aggregated KPIs."""
    result = await run_monte_carlo(
        n_runs=body.n_runs,
        n_stops=body.n_stops,
        n_vehicles=body.n_vehicles,
        slot_code=body.slot_code,
        base_seed=body.base_seed,
    )
    return MonteCarloResponse(**result)
