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

# Weeks of synthetic attempt history used to estimate per-slot home
# probabilities. Deeper history ⇒ a less noisy signal for slot selection.
_HISTORY_WEEKS = 16


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
class RouteStopDetail:
    """Geometry + outcome for a single visited stop, for map rendering."""
    stop_id: str
    latitude: float
    longitude: float
    sequence: int
    arrival_min: int
    assigned_slot: str
    predicted_prob: float
    outcome: str  # "success" | "miss"


@dataclass
class RouteDetail:
    """A single vehicle's route with full geometry for the frontend map."""
    vehicle_id: str
    vehicle_index: int
    stops: list[RouteStopDetail] = field(default_factory=list)
    duration_min: int = 0
    load: int = 0


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
    # Geometry — populated only when run_simulation(detailed=True).
    depot_lat: float = 0.0
    depot_lon: float = 0.0
    baseline_routes: list[RouteDetail] = field(default_factory=list)
    takumi_routes: list[RouteDetail] = field(default_factory=list)


def _simulate_deliveries(
    route_result: OptResult,
    stops: list[OptStop],
    ground_truth_probs: dict[str, float],
    rng: random.Random,
    outcomes: dict[str, str] | None = None,
) -> SimulationKPIs:
    """Simulate delivery outcomes for a set of routes.

    For each stop in the routes, flips a coin based on the ground-truth
    probability to determine if the delivery succeeds (recipient home)
    or fails (needs redelivery).

    If ``outcomes`` is provided, it is populated with a
    ``{stop_id: "success" | "miss"}`` mapping for geometry rendering.
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
                if outcomes is not None:
                    outcomes[route_stop.stop_id] = "success"
            else:
                kpis.deliveries_failed += 1
                if outcomes is not None:
                    outcomes[route_stop.stop_id] = "miss"

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


def _build_route_detail(
    route_result: OptResult,
    stops_by_id: dict[str, OptStop],
    slot_by_stop: dict[str, str],
    predicted_probs: dict[str, float],
    outcomes: dict[str, str],
) -> list[RouteDetail]:
    """Assemble per-stop geometry for the frontend map from a solved result."""
    details: list[RouteDetail] = []
    for route in route_result.routes:
        if not route.stops:
            continue
        route_stops: list[RouteStopDetail] = []
        for sequence, route_stop in enumerate(route.stops):
            stop = stops_by_id[route_stop.stop_id]
            route_stops.append(RouteStopDetail(
                stop_id=route_stop.stop_id,
                latitude=stop.latitude,
                longitude=stop.longitude,
                sequence=sequence,
                arrival_min=route_stop.arrival_seconds // 60,
                assigned_slot=slot_by_stop.get(route_stop.stop_id, ""),
                predicted_prob=round(predicted_probs.get(route_stop.stop_id, 0.5), 4),
                outcome=outcomes.get(route_stop.stop_id, "success"),
            ))
        details.append(RouteDetail(
            vehicle_id=route.vehicle_id,
            vehicle_index=route.vehicle_index,
            stops=route_stops,
            duration_min=route.total_duration_seconds // 60,
            load=route.load,
        ))
    return details


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
    slot_code: str = "am",  # baseline's fixed default window
    day_of_week: int = 2,  # Wednesday
    seed: int | None = None,
    ward: str = "koto",
    depot_lat: float = 35.672,
    depot_lon: float = 139.817,
    detailed: bool = False,
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

    # 2. Generate history for feature engineering. Deeper history yields a
    #    better-calibrated per-slot signal — the ML value proposition: more
    #    observed attempts ⇒ Takumi reliably identifies each stop's best slot.
    history = generate_availability_history(synth_stops, n_weeks=_HISTORY_WEEKS, seed=seed)

    # 3. Per-stop ground-truth schedule + ML-predicted best slot.
    #
    # Each recipient has a fixed "personality" bias applied across every slot,
    # so their genuine availability varies by window. The two policies differ
    # only in which window they attempt:
    #   - Baseline: the carrier's fixed default window (`slot_code`) for all
    #     stops — no availability awareness (§9 baseline definition).
    #   - Takumi: pre-pick each stop's argmax-predicted slot (§6.2 fallback) —
    #     this is the first-attempt thesis. Because the ML proxy correlates
    #     with (but is noisier than) ground truth, Takumi usually lands a
    #     genuinely better window, raising first-attempt success.
    is_weekday = day_of_week < 5

    def ground_truth(address_type: str, slot: str, personality: float) -> float:
        base_p = _BASE_PROBS.get((address_type, slot, is_weekday), 0.5)
        return max(0.05, min(0.95, base_p + personality))

    baseline_gt: dict[str, float] = {}
    takumi_gt: dict[str, float] = {}
    baseline_slot: dict[str, str] = {}
    takumi_slot: dict[str, str] = {}
    baseline_pred: dict[str, float] = {}
    takumi_pred: dict[str, float] = {}
    opt_stops: list[OptStop] = []

    for i, stop in enumerate(synth_stops):
        sid = stop["id"]
        addr = stop["address_type"]
        personality = rng.gauss(0, 0.08)

        # ML-predicted home probability per slot (historical-hit-rate proxy).
        slot_predictions = {
            s: generate_feature_row(stop, s, day_of_week, history)[
                "historical_hit_rate"
            ]
            for s in _SLOT_CODES
        }
        best_slot = max(slot_predictions, key=lambda s: slot_predictions[s])

        # Baseline: carrier's fixed default window for everyone.
        baseline_slot[sid] = slot_code
        baseline_pred[sid] = slot_predictions[slot_code]
        baseline_gt[sid] = ground_truth(addr, slot_code, personality)

        # Takumi: deliver in the recipient's best-predicted window.
        takumi_slot[sid] = best_slot
        takumi_pred[sid] = slot_predictions[best_slot]
        takumi_gt[sid] = ground_truth(addr, best_slot, personality)

        opt_stops.append(OptStop(
            index=i,
            stop_id=sid,
            latitude=stop["latitude"],
            longitude=stop["longitude"],
            demand=1,
            parcel_size=rng.choice(["60", "80", "100", "120"]),
            floor=stop.get("floor"),
            address_type=addr,
            penalty=probability_to_penalty(slot_predictions[best_slot]),
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

    baseline_outcomes: dict[str, str] = {}
    takumi_outcomes: dict[str, str] = {}
    baseline_kpis = _simulate_deliveries(
        baseline_result, opt_stops, baseline_gt, baseline_rng,
        outcomes=baseline_outcomes,
    )
    takumi_kpis = _simulate_deliveries(
        takumi_result, opt_stops, takumi_gt, takumi_rng,
        outcomes=takumi_outcomes,
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
        depot_lat=depot_lat,
        depot_lon=depot_lon,
    )

    if detailed:
        stops_by_id = {s.stop_id: s for s in opt_stops}
        result.baseline_routes = _build_route_detail(
            baseline_result, stops_by_id, baseline_slot,
            baseline_pred, baseline_outcomes,
        )
        result.takumi_routes = _build_route_detail(
            takumi_result, stops_by_id, takumi_slot,
            takumi_pred, takumi_outcomes,
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
    slot_code: str = "am",
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
