"""PyVRP benchmark — the same base VRPTW solved by OR-Tools and PyVRP.

OR-model rationale (§6.3): TakumiRoute's optimizer is OR-Tools running a
*prize-collecting* objective (slot selection + expected-value penalties).
To show that its underlying routing quality is sound, we solve the identical
base instance (visit every stop, minimise travel under capacity + shift +
time-window limits) with PyVRP — a specialised, high-quality VRP solver — and
compare total route time, feasibility, fleet size, and wall-clock. OR-Tools
gives us the flexible objective; PyVRP gives a quality yardstick.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, replace

from pyvrp import Model
from pyvrp.stop import MaxRuntime

from app.services.optimizer.solver import (
    OptStop,
    OptVehicle,
    _compute_service_time,
    build_travel_time_matrix,
    solve,
)

logger = logging.getLogger(__name__)

# Penalty high enough that OR-Tools always prefers visiting a stop to dropping
# it, so both solvers route the full instance for an apples-to-apples compare.
_REQUIRED_PENALTY = 1_000_000

# Degrees → integer microdegrees for PyVRP's integer coordinate space. Routing
# uses the explicit edge matrix, so these only affect display.
_COORD_SCALE = 100_000


@dataclass
class SolverBenchmark:
    """One solver's result on the shared instance."""

    solver: str
    feasible: bool
    total_route_seconds: int
    num_routes: int
    stops_visited: int
    wall_time_ms: int


@dataclass
class BenchmarkResult:
    n_stops: int
    n_vehicles: int
    ortools: SolverBenchmark
    pyvrp: SolverBenchmark


def _run_pyvrp(
    depot_lat: float,
    depot_lon: float,
    stops: list[OptStop],
    vehicles: list[OptVehicle],
    matrix: list[list[int]],
    time_limit_seconds: int,
) -> SolverBenchmark:
    """Solve the base VRPTW with PyVRP on the shared travel-time matrix."""
    model = Model()
    depot = model.add_depot(
        x=round(depot_lon * _COORD_SCALE), y=round(depot_lat * _COORD_SCALE)
    )
    model.add_vehicle_type(
        num_available=len(vehicles),
        capacity=max(v.capacity for v in vehicles),
        start_depot=depot,
        end_depot=depot,
        shift_duration=max(v.max_route_seconds for v in vehicles),
    )

    clients = [
        model.add_client(
            x=round(s.longitude * _COORD_SCALE),
            y=round(s.latitude * _COORD_SCALE),
            delivery=s.demand,
            service_duration=_compute_service_time(s),
        )
        for s in stops
    ]

    locations = [depot, *clients]
    for i, frm in enumerate(locations):
        for j, to in enumerate(locations):
            if i != j:
                # frm/to are Depot|Client; the mixed-list element type is object.
                model.add_edge(frm, to, distance=matrix[i][j], duration=matrix[i][j])  # type: ignore[arg-type]

    result = model.solve(
        stop=MaxRuntime(time_limit_seconds),
        seed=42,
        display=False,
        collect_stats=False,
    )
    best = result.best
    return SolverBenchmark(
        solver="pyvrp",
        feasible=bool(result.is_feasible()),
        total_route_seconds=int(best.duration()),
        num_routes=int(best.num_routes()),
        stops_visited=int(best.num_clients()),
        wall_time_ms=int(result.runtime * 1000),
    )


def run_benchmark(
    depot_lat: float,
    depot_lon: float,
    stops: list[OptStop],
    vehicles: list[OptVehicle],
    time_limit_seconds: int = 5,
) -> BenchmarkResult:
    """Solve one base VRPTW instance with both solvers and compare."""
    matrix = build_travel_time_matrix(depot_lat, depot_lon, stops)

    # Force OR-Tools to visit every stop so the comparison is on equal terms.
    required = [replace(s, penalty=_REQUIRED_PENALTY) for s in stops]
    ort = solve(
        depot_lat,
        depot_lon,
        required,
        vehicles,
        travel_time_matrix=matrix,
        time_limit_seconds=time_limit_seconds,
    )
    ortools_bm = SolverBenchmark(
        solver="ortools",
        feasible=ort.status in ("optimal", "feasible"),
        total_route_seconds=ort.total_distance_seconds,
        num_routes=len(ort.routes),
        stops_visited=ort.total_stops_visited,
        wall_time_ms=ort.solver_wall_time_ms,
    )

    pyvrp_bm = _run_pyvrp(
        depot_lat, depot_lon, stops, vehicles, matrix, time_limit_seconds
    )

    logger.info(
        "Benchmark %d stops: ortools=%ds/%d routes pyvrp=%ds/%d routes",
        len(stops),
        ortools_bm.total_route_seconds,
        ortools_bm.num_routes,
        pyvrp_bm.total_route_seconds,
        pyvrp_bm.num_routes,
    )
    return BenchmarkResult(
        n_stops=len(stops),
        n_vehicles=len(vehicles),
        ortools=ortools_bm,
        pyvrp=pyvrp_bm,
    )
