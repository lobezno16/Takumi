"""Tests for Phase 5 — OR-Tools VRPTW optimizer."""
from __future__ import annotations

from app.services.optimizer.solver import (
    OptStop,
    OptVehicle,
    build_travel_time_matrix,
    solve,
    _haversine_seconds,
    _compute_service_time,
)


# ── Unit tests ────────────────────────────────────────────────────────

async def test_haversine_seconds() -> None:
    """Haversine should return reasonable travel times for Tokyo distances."""
    # Koto-ku depot to a nearby stop (~1 km)
    time_s = _haversine_seconds(35.672, 139.817, 35.680, 139.820)
    assert 30 < time_s < 600  # 30s to 10min for ~1km at 25km/h


async def test_haversine_same_point() -> None:
    """Same point should return 0 travel time."""
    assert _haversine_seconds(35.672, 139.817, 35.672, 139.817) == 0


async def test_service_time_by_parcel() -> None:
    """Service time should scale with parcel size."""
    small = OptStop(index=0, stop_id="s1", latitude=0, longitude=0, parcel_size="60")
    large = OptStop(index=1, stop_id="s2", latitude=0, longitude=0, parcel_size="120")

    assert _compute_service_time(small) < _compute_service_time(large)


async def test_service_time_floor_penalty() -> None:
    """Higher floors should add service time for apartments."""
    ground = OptStop(index=0, stop_id="s1", latitude=0, longitude=0, floor=1)
    high = OptStop(index=1, stop_id="s2", latitude=0, longitude=0, floor=10)

    assert _compute_service_time(high) > _compute_service_time(ground)


async def test_build_matrix_haversine() -> None:
    """Haversine fallback matrix should be symmetric-ish and have 0 diagonal."""
    stops = [
        OptStop(index=0, stop_id="s1", latitude=35.672, longitude=139.817),
        OptStop(index=1, stop_id="s2", latitude=35.680, longitude=139.820),
    ]
    matrix = build_travel_time_matrix(35.670, 139.815, stops)

    assert len(matrix) == 3  # depot + 2 stops
    assert matrix[0][0] == 0
    assert matrix[1][1] == 0
    assert matrix[2][2] == 0
    assert matrix[0][1] > 0
    assert matrix[1][0] > 0


# ── Solver tests ──────────────────────────────────────────────────────

async def test_solve_empty_inputs() -> None:
    """Empty stops or vehicles should return no_solution."""
    result = solve(35.672, 139.817, [], [], time_limit_seconds=5)
    assert result.status == "no_solution"


async def test_solve_single_stop_single_vehicle() -> None:
    """Simplest case: 1 stop, 1 vehicle should visit the stop."""
    stops = [
        OptStop(
            index=0,
            stop_id="stop-1",
            latitude=35.675,
            longitude=139.820,
            penalty=10000,  # High penalty = must visit
            time_window_end=28800,
        ),
    ]
    vehicles = [
        OptVehicle(index=0, vehicle_id="v-1", capacity=80),
    ]

    result = solve(35.672, 139.817, stops, vehicles, time_limit_seconds=5)

    assert result.status in ("optimal", "feasible")
    assert result.total_stops_visited == 1
    assert result.total_stops_skipped == 0
    assert len(result.routes) == 1
    assert result.routes[0].stops[0].stop_id == "stop-1"


async def test_solve_respects_capacity() -> None:
    """Solver should not exceed vehicle capacity."""
    # 5 stops, each demand=20, vehicle capacity=80 → can fit 4 max
    stops = [
        OptStop(
            index=i,
            stop_id=f"stop-{i}",
            latitude=35.672 + i * 0.002,
            longitude=139.817,
            demand=20,
            penalty=10000,
            time_window_end=28800,
        )
        for i in range(5)
    ]
    vehicles = [
        OptVehicle(index=0, vehicle_id="v-1", capacity=80),
    ]

    result = solve(35.672, 139.817, stops, vehicles, time_limit_seconds=5)

    assert result.status in ("optimal", "feasible")
    for route in result.routes:
        assert route.load <= 80


async def test_solve_multiple_vehicles() -> None:
    """Multiple vehicles should split the workload."""
    stops = [
        OptStop(
            index=i,
            stop_id=f"stop-{i}",
            latitude=35.672 + i * 0.003,
            longitude=139.817 + (i % 2) * 0.003,
            penalty=10000,
            time_window_end=28800,
        )
        for i in range(10)
    ]
    vehicles = [
        OptVehicle(index=0, vehicle_id="v-1", capacity=80),
        OptVehicle(index=1, vehicle_id="v-2", capacity=80),
    ]

    result = solve(35.672, 139.817, stops, vehicles, time_limit_seconds=5)

    assert result.status in ("optimal", "feasible")
    assert result.total_stops_visited >= 5  # Should visit most stops


async def test_solve_penalty_influences_selection() -> None:
    """Stops with higher penalties should be prioritized over low-penalty ones."""
    # 2 vehicles capacity=1 each, 4 stops — only 2 can be visited
    stops = [
        OptStop(index=0, stop_id="high-1", latitude=35.673, longitude=139.818,
                demand=1, penalty=9999, time_window_end=28800),
        OptStop(index=1, stop_id="high-2", latitude=35.674, longitude=139.819,
                demand=1, penalty=9998, time_window_end=28800),
        OptStop(index=2, stop_id="low-1", latitude=35.675, longitude=139.820,
                demand=1, penalty=100, time_window_end=28800),
        OptStop(index=3, stop_id="low-2", latitude=35.676, longitude=139.821,
                demand=1, penalty=101, time_window_end=28800),
    ]
    vehicles = [
        OptVehicle(index=0, vehicle_id="v-1", capacity=1),
        OptVehicle(index=1, vehicle_id="v-2", capacity=1),
    ]

    result = solve(35.672, 139.817, stops, vehicles, time_limit_seconds=5)

    visited_ids = {
        s.stop_id for r in result.routes for s in r.stops
    }
    # High-penalty stops should be visited, low ones skipped
    assert "high-1" in visited_ids
    assert "high-2" in visited_ids


async def test_opt_result_has_timing() -> None:
    """Solution should report solver wall time."""
    stops = [
        OptStop(index=0, stop_id="s1", latitude=35.675, longitude=139.820,
                penalty=5000, time_window_end=28800),
    ]
    vehicles = [OptVehicle(index=0, vehicle_id="v1", capacity=80)]

    result = solve(35.672, 139.817, stops, vehicles, time_limit_seconds=5)
    assert result.solver_wall_time_ms >= 0
    assert result.objective_value >= 0
