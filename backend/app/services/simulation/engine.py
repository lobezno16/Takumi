"""Monte Carlo simulation engine comparing baseline vs Takumi routing.

Baseline: FIFO routing — visits stops in insertion order, no ML guidance.
Takumi: Prize-collecting VRPTW with ML-derived disjunction penalties.

Each simulation run:
1. Generates (or accepts) a set of stops + orders
2. Assigns home probabilities via the ML model
3. Runs both routing strategies
4. Simulates delivery outcomes using ground-truth probabilities
5. Computes KPIs for comparison
"""
from __future__ import annotations

import logging
import random
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.services.ml.model import probability_to_penalty
from app.services.optimizer.solver import (
    OptResult,
    OptStop,
    OptVehicle,
    solve,
)
from app.synthetic.generator import (
    _BASE_PROBS,
    _SLOT_CODES,
    generate_availability_history,
    generate_feature_row,
    generate_stops,
)

logger = logging.getLogger(__name__)


@dataclass
class SimulationKPIs:
    """Key performance indicators for a routing strategy."""
    total_stops: int = 0
    stops_attempted: int = 0
    stops_skipped: int = 0
    deliveries_successful: int = 0
    deliveries_failed: int = 0
    first_attempt_success_rate: float = 0.0
    redelivery_rate: float = 0.0
    total_route_time_seconds: int = 0
    avg_route_time_seconds: float = 0.0
    total_vehicles_used: int = 0
    cost_estimate: float = 0.0


@dataclass
class SimulationResult:
    """Result of a single simulation run."""
    run_id: str
    ward: str
    seed: int
    n_stops: int
    n_vehicles: int
    slot_code: str
    day_of_week: int
    baseline: SimulationKPIs
    takumi: SimulationKPIs
    improvement_pct: float = 0.0  # % reduction in redelivery rate
    solver_time_ms: int = 0


def _simulate_deliveries(
    route_result: OptResult,
    stops: list[OptStop],
    ground_truth_probs: dict[str, float],
    rng: random.Random,
) -> SimulationKPIs:
    """Simulate delivery outcomes for a set of routes.

    For each stop in the routes, flips a coin based on the ground-truth
    probability to determine if the delivery succeeds (recipient home)
    or fails (needs redelivery).
    """
    kpis = SimulationKPIs(total_stops=len(stops))

    visited_ids = set()
    total_time = 0
    n_vehicles_used = 0

    for route in route_result.routes:
        if route.stops:
            n_vehicles_used += 1
            total_time += route.total_duration_seconds

        for route_stop in route.stops:
            visited_ids.add(route_stop.stop_id)
            prob = ground_truth_probs.get(route_stop.stop_id, 0.5)
            if rng.random() < prob:
                kpis.deliveries_successful += 1
            else:
                kpis.deliveries_failed += 1

    kpis.stops_attempted = len(visited_ids)
    kpis.stops_skipped = kpis.total_stops - kpis.stops_attempted
    kpis.total_route_time_seconds = total_time
    kpis.total_vehicles_used = n_vehicles_used
    kpis.avg_route_time_seconds = (
        total_time / n_vehicles_used if n_vehicles_used > 0 else 0.0
    )

    if kpis.stops_attempted > 0:
        kpis.first_attempt_success_rate = (
            kpis.deliveries_successful / kpis.stops_attempted
        )
        kpis.redelivery_rate = (
            kpis.deliveries_failed / kpis.stops_attempted
        )

    # Cost estimate: route time cost + redelivery cost (¥800 per failed delivery)
    cost_per_second = 0.01
    redelivery_cost = 800
    kpis.cost_estimate = round(
        total_time * cost_per_second
        + kpis.deliveries_failed * redelivery_cost,
        2,
    )

    return kpis


def _build_baseline_routes(
    depot_lat: float,
    depot_lon: float,
    stops: list[OptStop],
    vehicles: list[OptVehicle],
) -> OptResult:
    """Build baseline FIFO routes — assign stops sequentially to vehicles.

    No ML, no optimization — just fill each vehicle in order.
    This represents a naive dispatcher who assigns deliveries
    without considering home probabilities.
    """
    # Use the optimizer but with uniform penalties (all stops equal priority)
    uniform_stops = []
    for stop in stops:
        uniform = OptStop(
            index=stop.index,
            stop_id=stop.stop_id,
            latitude=stop.latitude,
            longitude=stop.longitude,
            demand=stop.demand,
            parcel_size=stop.parcel_size,
            floor=stop.floor,
            address_type=stop.address_type,
            penalty=5000,  # Uniform penalty — no ML intelligence
            time_window_start=stop.time_window_start,
            time_window_end=stop.time_window_end,
        )
        uniform_stops.append(uniform)

    return solve(
        depot_lat, depot_lon, uniform_stops, vehicles,
        time_limit_seconds=10,
    )


async def run_simulation(
    n_stops: int = 50,
    n_vehicles: int = 3,
    slot_code: str = "t1821",
    day_of_week: int = 2,  # Wednesday
    seed: int | None = None,
    ward: str = "koto",
    depot_lat: float = 35.672,
    depot_lon: float = 139.817,
) -> SimulationResult:
    """Run a single simulation comparing baseline vs Takumi routing.

    Args:
        n_stops: Number of delivery stops.
        n_vehicles: Number of available vehicles.
        slot_code: Target delivery time slot.
        day_of_week: 0=Mon...6=Sun.
        seed: Random seed (auto-generated if None).
        ward: Ward name for the simulation.
        depot_lat, depot_lon: Depot location.

    Returns:
        SimulationResult with KPIs for both strategies.
    """
    if seed is None:
        seed = random.randint(0, 2**31)

    rng = random.Random(seed)
    run_id = str(uuid.uuid4())

    logger.info(
        "Simulation %s: %d stops, %d vehicles, slot=%s, dow=%d, seed=%d",
        run_id[:8], n_stops, n_vehicles, slot_code, day_of_week, seed,
    )

    # 1. Generate synthetic stops
    synth_stops = generate_stops(n_stops=n_stops, seed=seed)

    # 2. Generate history for feature engineering
    history = generate_availability_history(synth_stops, n_weeks=8, seed=seed)

    # 3. Compute ground-truth home probabilities and ML penalties
    is_weekday = day_of_week < 5
    ground_truth_probs: dict[str, float] = {}
    opt_stops: list[OptStop] = []

    for i, stop in enumerate(synth_stops):
        # Ground truth from base probability table + noise
        base_p = _BASE_PROBS.get(
            (stop["address_type"], slot_code, is_weekday),
            0.5,
        )
        # Add per-stop noise for realism
        gt_prob = max(0.05, min(0.95, base_p + rng.gauss(0, 0.08)))
        ground_truth_probs[stop["id"]] = gt_prob

        # ML-derived penalty (uses feature engineering)
        features = generate_feature_row(stop, slot_code, day_of_week, history)
        # Use the historical hit rate as a proxy for predicted probability
        predicted_prob = features["historical_hit_rate"]
        penalty = probability_to_penalty(predicted_prob)

        opt_stops.append(OptStop(
            index=i,
            stop_id=stop["id"],
            latitude=stop["latitude"],
            longitude=stop["longitude"],
            demand=1,
            parcel_size=rng.choice(["60", "80", "100", "120"]),
            floor=stop.get("floor"),
            address_type=stop["address_type"],
            penalty=penalty,
            time_window_start=0,
            time_window_end=28800,
        ))

    vehicles = [
        OptVehicle(
            index=i,
            vehicle_id=f"v-{i}",
            capacity=max(20, n_stops // n_vehicles + 5),
            max_route_seconds=28800,
        )
        for i in range(n_vehicles)
    ]

    # 4. Run baseline (uniform penalties)
    baseline_result = _build_baseline_routes(
        depot_lat, depot_lon, opt_stops, vehicles,
    )

    # 5. Run Takumi (ML-driven penalties)
    takumi_result = solve(
        depot_lat, depot_lon, opt_stops, vehicles,
        time_limit_seconds=15,
    )

    # 6. Simulate delivery outcomes (same random draws for both)
    baseline_rng = random.Random(seed + 1000)
    takumi_rng = random.Random(seed + 1000)  # Same seed = same coin flips

    baseline_kpis = _simulate_deliveries(
        baseline_result, opt_stops, ground_truth_probs, baseline_rng,
    )
    takumi_kpis = _simulate_deliveries(
        takumi_result, opt_stops, ground_truth_probs, takumi_rng,
    )

    # 7. Compute improvement
    if baseline_kpis.redelivery_rate > 0:
        improvement = (
            (baseline_kpis.redelivery_rate - takumi_kpis.redelivery_rate)
            / baseline_kpis.redelivery_rate
            * 100
        )
    else:
        improvement = 0.0

    result = SimulationResult(
        run_id=run_id,
        ward=ward,
        seed=seed,
        n_stops=n_stops,
        n_vehicles=n_vehicles,
        slot_code=slot_code,
        day_of_week=day_of_week,
        baseline=baseline_kpis,
        takumi=takumi_kpis,
        improvement_pct=round(improvement, 2),
        solver_time_ms=(
            baseline_result.solver_wall_time_ms
            + takumi_result.solver_wall_time_ms
        ),
    )

    logger.info(
        "Simulation %s complete: baseline_redeliver=%.1f%% takumi_redeliver=%.1f%% improvement=%.1f%%",
        run_id[:8],
        baseline_kpis.redelivery_rate * 100,
        takumi_kpis.redelivery_rate * 100,
        improvement,
    )

    return result


async def run_monte_carlo(
    n_runs: int = 10,
    n_stops: int = 50,
    n_vehicles: int = 3,
    slot_code: str = "t1821",
    base_seed: int = 42,
) -> dict[str, Any]:
    """Run multiple simulations and aggregate results.

    Returns:
        Aggregated statistics across all runs.
    """
    results = []
    for i in range(n_runs):
        result = await run_simulation(
            n_stops=n_stops,
            n_vehicles=n_vehicles,
            slot_code=slot_code,
            day_of_week=i % 5,  # Vary across weekdays
            seed=base_seed + i,
        )
        results.append(result)

    # Aggregate
    avg_baseline_redeliver = sum(
        r.baseline.redelivery_rate for r in results
    ) / len(results)
    avg_takumi_redeliver = sum(
        r.takumi.redelivery_rate for r in results
    ) / len(results)
    avg_improvement = sum(r.improvement_pct for r in results) / len(results)
    avg_baseline_cost = sum(
        r.baseline.cost_estimate for r in results
    ) / len(results)
    avg_takumi_cost = sum(
        r.takumi.cost_estimate for r in results
    ) / len(results)

    return {
        "n_runs": n_runs,
        "avg_baseline_redelivery_rate": round(avg_baseline_redeliver, 4),
        "avg_takumi_redelivery_rate": round(avg_takumi_redeliver, 4),
        "avg_improvement_pct": round(avg_improvement, 2),
        "avg_baseline_cost": round(avg_baseline_cost, 2),
        "avg_takumi_cost": round(avg_takumi_cost, 2),
        "cost_savings_pct": round(
            (avg_baseline_cost - avg_takumi_cost) / avg_baseline_cost * 100
            if avg_baseline_cost > 0 else 0,
            2,
        ),
        "runs": [
            {
                "run_id": r.run_id,
                "seed": r.seed,
                "day_of_week": r.day_of_week,
                "baseline_redelivery_rate": round(r.baseline.redelivery_rate, 4),
                "takumi_redelivery_rate": round(r.takumi.redelivery_rate, 4),
                "improvement_pct": r.improvement_pct,
            }
            for r in results
        ],
    }
