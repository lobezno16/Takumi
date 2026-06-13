"""OSRM travel-time matrix service.

Calls the OSRM Table API to build NxN duration/distance matrices
between sets of coordinates, with Redis caching.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings
from app.services.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

# Cache TTL: 1 hour for travel-time matrices (road network rarely changes)
_MATRIX_CACHE_TTL = 3600


@dataclass(frozen=True)
class Coordinate:
    """A WGS84 coordinate (longitude, latitude) — OSRM uses lon,lat order."""

    lon: float
    lat: float


@dataclass
class MatrixResult:
    """Result of an OSRM table query."""

    durations: list[list[float]]
    distances: list[list[float | None]]
    sources: list[dict[str, Any]]
    destinations: list[dict[str, Any]]


async def _call_osrm_table(
    coordinates: list[Coordinate],
    sources: list[int] | None = None,
    destinations: list[int] | None = None,
) -> dict[str, Any]:
    """Call the OSRM Table API and return the raw JSON response."""
    coords_str = ";".join(f"{c.lon},{c.lat}" for c in coordinates)
    url = f"{settings.OSRM_URL}/table/v1/driving/{coords_str}"

    params: dict[str, str] = {"annotations": "duration,distance"}
    if sources is not None:
        params["sources"] = ";".join(str(s) for s in sources)
    if destinations is not None:
        params["destinations"] = ";".join(str(d) for d in destinations)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    if data.get("code") != "Ok":
        msg = data.get("message", "Unknown OSRM error")
        raise RuntimeError(f"OSRM table request failed: {msg}")

    return data


async def get_travel_time_matrix(
    coordinates: list[Coordinate],
    sources: list[int] | None = None,
    destinations: list[int] | None = None,
    use_cache: bool = True,
) -> MatrixResult:
    """Build a travel-time matrix between the given coordinates.

    Args:
        coordinates: List of (lon, lat) points.
        sources: Indices of source coordinates (default: all).
        destinations: Indices of destination coordinates (default: all).
        use_cache: Whether to check/populate the Redis cache.

    Returns:
        MatrixResult with durations (seconds) and distances (meters).
    """
    cache_data = {
        "coords": [(c.lon, c.lat) for c in coordinates],
        "sources": sources,
        "destinations": destinations,
    }

    if use_cache:
        cached = await cache_get("matrix", cache_data)
        if cached is not None:
            logger.info("Matrix cache hit (%d coordinates)", len(coordinates))
            return MatrixResult(**cached)

    logger.info("Calling OSRM table API with %d coordinates", len(coordinates))
    data = await _call_osrm_table(coordinates, sources, destinations)

    result = MatrixResult(
        durations=data["durations"],
        distances=data.get("distances", []),
        sources=data.get("sources", []),
        destinations=data.get("destinations", []),
    )

    if use_cache:
        cache_value = {
            "durations": result.durations,
            "distances": result.distances,
            "sources": result.sources,
            "destinations": result.destinations,
        }
        await cache_set("matrix", cache_data, cache_value, ttl_seconds=_MATRIX_CACHE_TTL)

    return result


async def get_single_route_duration(
    origin: Coordinate, destination: Coordinate
) -> float | None:
    """Get travel duration in seconds between two points.

    Returns None if the route cannot be computed.
    """
    try:
        result = await get_travel_time_matrix(
            [origin, destination],
            sources=[0],
            destinations=[1],
            use_cache=True,
        )
        duration = result.durations[0][0]
        return duration if duration is not None else None
    except (RuntimeError, httpx.HTTPError) as exc:
        logger.warning("OSRM route failed: %s", exc)
        return None


async def check_osrm_health() -> bool:
    """Check if the OSRM service is reachable and healthy."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # OSRM doesn't have a /health endpoint — use a nearest query
            # with a known Tokyo coordinate as a health check
            url = f"{settings.OSRM_URL}/nearest/v1/driving/139.817,35.672"
            response = await client.get(url)
            data = response.json()
            return data.get("code") == "Ok"
    except (httpx.HTTPError, Exception):
        return False
