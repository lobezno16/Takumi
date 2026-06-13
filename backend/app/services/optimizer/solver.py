"""OR-Tools prize-collecting VRPTW optimizer for TakumiRoute.

This module implements the core routing optimization:
- Capacitated Vehicle Routing Problem with Time Windows (CVRPTW)
- Prize-collecting via AddDisjunction: each stop has a penalty for skipping
  proportional to the ML-predicted home probability
- Multi-vehicle fleet with depot start/end
- Travel-time matrix from OSRM (or fallback Haversine)
- Service time per stop based on parcel size and floor

The optimizer produces routes that maximize expected successful deliveries
while respecting vehicle capacity, time windows, and route duration limits.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

logger = logging.getLogger(__name__)

# Service time per parcel size (seconds)
_SERVICE_TIME_BY_SIZE = {
    "60": 120,  # Small: 2 min
    "80": 150,  # Medium: 2.5 min
    "100": 180,  # Large: 3 min
    "120": 240,  # XL: 4 min
}

# Extra time per floor above ground (seconds, for apartments)
_FLOOR_PENALTY_SECONDS = 15


@dataclass
class OptStop:
    """A stop to consider for routing."""

    index: int
    stop_id: str
    latitude: float
    longitude: float
    demand: int = 1
    parcel_size: str = "60"
    floor: int | None = None
    address_type: str = "apartment"
    penalty: int = 5000  # Disjunction penalty from ML model
    time_window_start: int = 0  # seconds from depot shift start
    time_window_end: int = 28800  # 8 hours default


@dataclass
class OptVehicle:
    """A vehicle available for routing."""

    index: int
    vehicle_id: str
    capacity: int = 80
    max_route_seconds: int = 28800  # 8 hours
    cost_per_second: float = 0.01


@dataclass
class OptResult:
    """Result of the optimization."""

    status: str  # "optimal", "feasible", "no_solution"
    routes: list[OptRoute]
    total_distance_seconds: int = 0
    total_stops_visited: int = 0
    total_stops_skipped: int = 0
    objective_value: int = 0
    solver_wall_time_ms: int = 0


@dataclass
class OptRoute:
    """A single vehicle's optimized route."""

    vehicle_id: str
    vehicle_index: int
    stops: list[OptRouteStop] = field(default_factory=list)
    total_duration_seconds: int = 0
    total_distance_seconds: int = 0
    load: int = 0


@dataclass
class OptRouteStop:
    """A stop in an optimized route."""

    stop_id: str
    stop_index: int
    arrival_seconds: int = 0
    departure_seconds: int = 0
    service_time_seconds: int = 0
    cumulative_load: int = 0


def _haversine_seconds(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    speed_kmh: float = 25.0,
) -> int:
    """Haversine distance converted to travel time in seconds.

    Default speed 25 km/h approximates urban driving in Tokyo.
    """
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    dist_km = R * c
    return int(dist_km / speed_kmh * 3600)


def _compute_service_time(stop: OptStop) -> int:
    """Calculate service time for a stop based on parcel size and floor."""
    base = _SERVICE_TIME_BY_SIZE.get(stop.parcel_size, 150)
    floor_extra = 0
    if stop.floor is not None and stop.floor > 1:
        floor_extra = (stop.floor - 1) * _FLOOR_PENALTY_SECONDS
    return base + floor_extra


def build_travel_time_matrix(
    depot_lat: float,
    depot_lon: float,
    stops: list[OptStop],
    osrm_matrix: list[list[float]] | None = None,
) -> list[list[int]]:
    """Build the NxN travel-time matrix (seconds).

    Node 0 = depot. Nodes 1..N = stops.

    Args:
        depot_lat, depot_lon: Depot coordinates.
        stops: List of stops.
        osrm_matrix: Pre-computed OSRM matrix (if available).

    Returns:
        Matrix[i][j] = travel time in seconds from node i to node j.
    """
    if osrm_matrix is not None:
        # OSRM matrix is already in the right format
        return [[int(cell) for cell in row] for row in osrm_matrix]

    # Fall back to Haversine great-circle travel times.
    n = len(stops) + 1  # +1 for depot
    all_coords = [(depot_lat, depot_lon)] + [(s.latitude, s.longitude) for s in stops]

    matrix = []
    for i in range(n):
        row = []
        for j in range(n):
            if i == j:
                row.append(0)
            else:
                row.append(
                    _haversine_seconds(
                        all_coords[i][0],
                        all_coords[i][1],
                        all_coords[j][0],
                        all_coords[j][1],
                    )
                )
        matrix.append(row)

    return matrix


def solve(
    depot_lat: float,
    depot_lon: float,
    stops: list[OptStop],
    vehicles: list[OptVehicle],
    travel_time_matrix: list[list[int]] | None = None,
    time_limit_seconds: int = 30,
) -> OptResult:
    """Solve the prize-collecting CVRPTW.

    Args:
        depot_lat, depot_lon: Depot coordinates.
        stops: Candidate delivery stops with penalties from ML model.
        vehicles: Available vehicles.
        travel_time_matrix: Pre-computed matrix (or None for Haversine).
        time_limit_seconds: Solver wall-time limit.

    Returns:
        OptResult with optimized routes.
    """
    if not stops or not vehicles:
        return OptResult(
            status="no_solution",
            routes=[],
        )

    n_stops = len(stops)
    n_vehicles = len(vehicles)
    n_nodes = n_stops + 1  # node 0 = depot

    # Build travel time matrix if not provided
    matrix = travel_time_matrix or build_travel_time_matrix(depot_lat, depot_lon, stops)

    # Service times per node
    service_times = [0]  # depot has 0 service time
    for stop in stops:
        service_times.append(_compute_service_time(stop))

    # Create routing index manager
    # All vehicles start and end at depot (node 0)
    manager = pywrapcp.RoutingIndexManager(n_nodes, n_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    # ── Transit callback (travel time + service time) ─────────────────
    def transit_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        travel = matrix[from_node][to_node]
        service = service_times[from_node]
        return travel + service

    transit_callback_index = routing.RegisterTransitCallback(transit_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # ── Time dimension ────────────────────────────────────────────────
    max_route_time = max(v.max_route_seconds for v in vehicles)
    routing.AddDimension(
        transit_callback_index,
        3600,  # allow 1 hour slack for waiting
        max_route_time,
        False,  # don't force start cumul to zero (allows flexible start)
        "Time",
    )
    time_dimension = routing.GetDimensionOrDie("Time")

    # Set time windows for each stop
    for i, stop in enumerate(stops):
        node_index = manager.NodeToIndex(i + 1)  # +1 because depot is 0
        time_dimension.CumulVar(node_index).SetRange(
            stop.time_window_start,
            stop.time_window_end,
        )

    # Set vehicle route duration limits
    for v_idx, vehicle in enumerate(vehicles):
        start_index = routing.Start(v_idx)
        end_index = routing.End(v_idx)
        time_dimension.CumulVar(start_index).SetRange(0, vehicle.max_route_seconds)
        time_dimension.CumulVar(end_index).SetRange(0, vehicle.max_route_seconds)

    # ── Capacity dimension ────────────────────────────────────────────
    def demand_callback(from_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        if from_node == 0:
            return 0  # depot
        return stops[from_node - 1].demand

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # no slack on capacity
        [v.capacity for v in vehicles],
        True,  # start cumul at 0
        "Capacity",
    )

    # ── Prize-collecting: AddDisjunction for each stop ────────────────
    # Each stop can be optionally skipped at a cost (penalty).
    # Higher penalty = more costly to skip = ML says person is likely home.
    for i, stop in enumerate(stops):
        node_index = manager.NodeToIndex(i + 1)
        routing.AddDisjunction([node_index], stop.penalty)

    # ── Search parameters ─────────────────────────────────────────────
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = time_limit_seconds
    search_params.log_search = False

    # ── Solve ─────────────────────────────────────────────────────────
    logger.info(
        "Solving VRPTW: %d stops, %d vehicles, time_limit=%ds",
        n_stops,
        n_vehicles,
        time_limit_seconds,
    )
    solution = routing.SolveWithParameters(search_params)

    if solution is None:
        logger.warning("No solution found")
        return OptResult(
            status="no_solution",
            routes=[],
            total_stops_skipped=n_stops,
        )

    # ── Extract solution ──────────────────────────────────────────────
    status = "optimal" if routing.status() == 1 else "feasible"
    routes: list[OptRoute] = []
    total_visited = 0
    total_duration = 0

    for v_idx in range(n_vehicles):
        route = OptRoute(
            vehicle_id=vehicles[v_idx].vehicle_id,
            vehicle_index=v_idx,
        )
        index = routing.Start(v_idx)
        route_load = 0

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            time_var = time_dimension.CumulVar(index)
            arrival = solution.Min(time_var)

            if node != 0:  # Skip depot
                stop = stops[node - 1]
                svc_time = service_times[node]
                route_load += stop.demand

                route.stops.append(
                    OptRouteStop(
                        stop_id=stop.stop_id,
                        stop_index=stop.index,
                        arrival_seconds=arrival,
                        departure_seconds=arrival + svc_time,
                        service_time_seconds=svc_time,
                        cumulative_load=route_load,
                    )
                )

            index = solution.Value(routing.NextVar(index))

        # End node
        end_time_var = time_dimension.CumulVar(index)
        route_duration = solution.Min(end_time_var)

        route.total_duration_seconds = route_duration
        route.total_distance_seconds = route_duration  # approximate
        route.load = route_load
        total_visited += len(route.stops)
        total_duration += route_duration

        if route.stops:  # Only add non-empty routes
            routes.append(route)

    result = OptResult(
        status=status,
        routes=routes,
        total_distance_seconds=total_duration,
        total_stops_visited=total_visited,
        total_stops_skipped=n_stops - total_visited,
        objective_value=int(solution.ObjectiveValue()),
        solver_wall_time_ms=int(routing.solver().WallTime()),
    )

    logger.info(
        "Solution found: %s, %d routes, %d/%d stops visited, obj=%d, wall=%dms",
        result.status,
        len(routes),
        total_visited,
        n_stops,
        result.objective_value,
        result.solver_wall_time_ms,
    )

    return result
