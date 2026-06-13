"""Tests for Phase 10 — PyVRP vs OR-Tools benchmark."""

from __future__ import annotations

from app.services.optimizer.benchmark import run_benchmark
from app.services.optimizer.solver import OptStop, OptVehicle
from app.synthetic.generator import generate_stops


def _instance(n_stops: int, n_vehicles: int, seed: int = 7):
    synth = generate_stops(n_stops=n_stops, seed=seed)
    stops = [
        OptStop(
            index=i,
            stop_id=s["id"],
            latitude=s["latitude"],
            longitude=s["longitude"],
            demand=1,
            parcel_size="80",
            floor=s.get("floor"),
            address_type=s["address_type"],
        )
        for i, s in enumerate(synth)
    ]
    vehicles = [
        OptVehicle(index=i, vehicle_id=f"v-{i}", capacity=30, max_route_seconds=28800)
        for i in range(n_vehicles)
    ]
    return stops, vehicles


def test_both_solvers_feasible_and_comparable() -> None:
    """Both solvers must produce feasible routes over the same instance."""
    stops, vehicles = _instance(20, 3)
    result = run_benchmark(35.672, 139.817, stops, vehicles, time_limit_seconds=2)

    assert result.ortools.feasible
    assert result.pyvrp.feasible
    # Both route the full instance (every stop required).
    assert result.ortools.stops_visited == 20
    assert result.pyvrp.stops_visited == 20
    # Positive route time and at least one vehicle used for each.
    assert result.ortools.total_route_seconds > 0
    assert result.pyvrp.total_route_seconds > 0
    assert result.ortools.num_routes >= 1
    assert result.pyvrp.num_routes >= 1


def test_benchmark_wall_clock_recorded() -> None:
    """Each solver reports a non-negative wall-clock measurement."""
    stops, vehicles = _instance(15, 2)
    result = run_benchmark(35.672, 139.817, stops, vehicles, time_limit_seconds=1)

    assert result.ortools.wall_time_ms >= 0
    assert result.pyvrp.wall_time_ms >= 0
