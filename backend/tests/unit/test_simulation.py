"""Tests for Phase 6 — Simulation engine."""

from __future__ import annotations

from app.services.optimizer.solver import OptResult, OptRoute, OptRouteStop, OptStop
from app.services.simulation.engine import (
    _simulate_deliveries,
    run_simulation,
)

# ── Unit tests ────────────────────────────────────────────────────────


async def test_simulate_deliveries_all_home() -> None:
    """If everyone is home (prob=1.0), all deliveries should succeed."""
    import random

    stops = [
        OptStop(index=0, stop_id="s1", latitude=35.67, longitude=139.82),
        OptStop(index=1, stop_id="s2", latitude=35.68, longitude=139.82),
    ]
    route = OptRoute(
        vehicle_id="v1",
        vehicle_index=0,
        stops=[
            OptRouteStop(stop_id="s1", stop_index=0),
            OptRouteStop(stop_id="s2", stop_index=1),
        ],
        total_duration_seconds=1000,
    )
    result = OptResult(status="optimal", routes=[route])
    probs = {"s1": 1.0, "s2": 1.0}

    kpis = _simulate_deliveries(result, stops, probs, random.Random(42))

    assert kpis.deliveries_successful == 2
    assert kpis.deliveries_failed == 0
    assert kpis.first_attempt_success_rate == 1.0
    assert kpis.redelivery_rate == 0.0


async def test_simulate_deliveries_none_home() -> None:
    """If nobody is home (prob=0.0), all deliveries should fail."""
    import random

    stops = [
        OptStop(index=0, stop_id="s1", latitude=35.67, longitude=139.82),
    ]
    route = OptRoute(
        vehicle_id="v1",
        vehicle_index=0,
        stops=[OptRouteStop(stop_id="s1", stop_index=0)],
        total_duration_seconds=500,
    )
    result = OptResult(status="optimal", routes=[route])
    probs = {"s1": 0.0}

    kpis = _simulate_deliveries(result, stops, probs, random.Random(42))

    assert kpis.deliveries_successful == 0
    assert kpis.deliveries_failed == 1
    assert kpis.redelivery_rate == 1.0


async def test_simulate_deliveries_cost_includes_redelivery() -> None:
    """Cost should include redelivery penalty (¥800) for failed deliveries."""
    import random

    stops = [
        OptStop(index=0, stop_id="s1", latitude=35.67, longitude=139.82),
    ]
    route = OptRoute(
        vehicle_id="v1",
        vehicle_index=0,
        stops=[OptRouteStop(stop_id="s1", stop_index=0)],
        total_duration_seconds=1000,
    )
    result = OptResult(status="optimal", routes=[route])
    probs = {"s1": 0.0}

    kpis = _simulate_deliveries(result, stops, probs, random.Random(42))

    # Cost = 1000s * 0.01 + 1 failed * ¥800 = 10 + 800 = 810
    assert kpis.cost_estimate == 810.0


async def test_kpis_skipped_stops() -> None:
    """Stops not in any route should be counted as skipped."""
    import random

    stops = [
        OptStop(index=0, stop_id="s1", latitude=35.67, longitude=139.82),
        OptStop(index=1, stop_id="s2", latitude=35.68, longitude=139.82),
        OptStop(index=2, stop_id="s3", latitude=35.69, longitude=139.82),
    ]
    # Only visit s1
    route = OptRoute(
        vehicle_id="v1",
        vehicle_index=0,
        stops=[OptRouteStop(stop_id="s1", stop_index=0)],
        total_duration_seconds=500,
    )
    result = OptResult(status="optimal", routes=[route])
    probs = {"s1": 1.0, "s2": 0.5, "s3": 0.5}

    kpis = _simulate_deliveries(result, stops, probs, random.Random(42))

    assert kpis.total_stops == 3
    assert kpis.stops_attempted == 1
    assert kpis.stops_skipped == 2


# ── Integration test ─────────────────────────────────────────────────


async def test_run_simulation_produces_valid_result() -> None:
    """A full simulation run should produce valid KPIs for both strategies."""
    result = await run_simulation(
        n_stops=15,
        n_vehicles=2,
        slot_code="t1821",
        day_of_week=2,
        seed=42,
    )

    # Basic structure
    assert result.run_id
    assert result.seed == 42
    assert result.n_stops == 15
    assert result.slot_code == "t1821"

    # Both strategies should have attempted some stops
    assert result.baseline.stops_attempted > 0
    assert result.takumi.stops_attempted > 0

    # Rates should be in [0, 1]
    assert 0.0 <= result.baseline.first_attempt_success_rate <= 1.0
    assert 0.0 <= result.takumi.first_attempt_success_rate <= 1.0
    assert 0.0 <= result.baseline.redelivery_rate <= 1.0
    assert 0.0 <= result.takumi.redelivery_rate <= 1.0

    # Costs should be non-negative
    assert result.baseline.cost_estimate >= 0
    assert result.takumi.cost_estimate >= 0


async def test_simulation_deterministic() -> None:
    """Same seed should produce identical results."""
    r1 = await run_simulation(n_stops=10, n_vehicles=2, seed=123)
    r2 = await run_simulation(n_stops=10, n_vehicles=2, seed=123)

    assert r1.baseline.deliveries_successful == r2.baseline.deliveries_successful
    assert r1.takumi.deliveries_successful == r2.takumi.deliveries_successful
    assert r1.improvement_pct == r2.improvement_pct


async def test_takumi_beats_naive_baseline_via_slot_selection() -> None:
    """Against a naive AM-only baseline, Takumi must cut redelivery by
    choosing each recipient's best-predicted window (the project thesis)."""
    result = await run_simulation(
        n_stops=30,
        n_vehicles=3,
        slot_code="am",
        day_of_week=2,
        seed=5,
        detailed=True,
    )

    # First-attempt thesis: fewer redeliveries than the fixed-window baseline.
    assert result.takumi.redelivery_rate < result.baseline.redelivery_rate
    assert result.improvement_pct > 0

    # Slot selection actually varied — Takumi did not just copy the AM default.
    chosen = {
        stop.assigned_slot for route in result.takumi_routes for stop in route.stops
    }
    assert chosen - {"am"}, "Takumi should pick non-AM windows for some stops"


async def test_detailed_routes_have_geometry() -> None:
    """Detailed runs expose real per-stop coordinates and outcomes for the map."""
    result = await run_simulation(
        n_stops=12,
        n_vehicles=2,
        slot_code="am",
        seed=7,
        detailed=True,
    )

    assert result.depot_lat != 0.0 and result.depot_lon != 0.0
    assert result.takumi_routes, "expected at least one Takumi route"
    for route in result.takumi_routes:
        for stop in route.stops:
            assert -90 <= stop.latitude <= 90
            assert -180 <= stop.longitude <= 180
            assert stop.outcome in ("success", "miss")
            assert 0.0 <= stop.predicted_prob <= 1.0
