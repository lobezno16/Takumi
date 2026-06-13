"""Tests for Phase 2 — OSRM matrix service, cache, and API."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.services.matrix import Coordinate, MatrixResult


async def test_health_survives_phase2(client: AsyncClient) -> None:
    """Phase 0 health endpoint still works after adding matrix router."""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_matrix_endpoint_exists(client: AsyncClient) -> None:
    """POST /api/matrix endpoint should be registered."""
    # Without OSRM running, it should return 503 or 502, not 404
    response = await client.post(
        "/api/matrix",
        json={
            "coordinates": [
                {"lon": 139.817, "lat": 35.672},
                {"lon": 139.820, "lat": 35.675},
            ]
        },
    )
    # Should not be 404 (route exists) or 422 (valid schema)
    assert response.status_code != 404
    assert response.status_code != 422


async def test_matrix_request_validation(client: AsyncClient) -> None:
    """Matrix endpoint should reject invalid coordinates."""
    # Too few coordinates (min 2)
    response = await client.post(
        "/api/matrix",
        json={"coordinates": [{"lon": 139.817, "lat": 35.672}]},
    )
    assert response.status_code == 422

    # Invalid longitude
    response = await client.post(
        "/api/matrix",
        json={
            "coordinates": [
                {"lon": 999, "lat": 35.672},
                {"lon": 139.820, "lat": 35.675},
            ]
        },
    )
    assert response.status_code == 422

    # Extra fields rejected
    response = await client.post(
        "/api/matrix",
        json={
            "coordinates": [
                {"lon": 139.817, "lat": 35.672},
                {"lon": 139.820, "lat": 35.675},
            ],
            "extra_field": "bad",
        },
    )
    assert response.status_code == 422


async def test_matrix_with_mocked_osrm(client: AsyncClient) -> None:
    """Matrix endpoint should return correct response when OSRM is mocked."""
    mock_result = MatrixResult(
        durations=[[0, 120.5], [115.3, 0]],
        distances=[[0, 1500], [1450, 0]],
        sources=[
            {"hint": "abc", "location": [139.817, 35.672]},
            {"hint": "def", "location": [139.820, 35.675]},
        ],
        destinations=[
            {"hint": "abc", "location": [139.817, 35.672]},
            {"hint": "def", "location": [139.820, 35.675]},
        ],
    )

    with patch(
        "app.api.matrix.get_travel_time_matrix",
        new_callable=AsyncMock,
        return_value=mock_result,
    ):
        response = await client.post(
            "/api/matrix",
            json={
                "coordinates": [
                    {"lon": 139.817, "lat": 35.672},
                    {"lon": 139.820, "lat": 35.675},
                ]
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert len(data["durations"]) == 2
    assert len(data["durations"][0]) == 2
    assert data["durations"][0][1] == 120.5
    assert data["distances"][0][1] == 1500


async def test_osrm_health_endpoint_exists(client: AsyncClient) -> None:
    """GET /api/matrix/health should exist (returns 503 without OSRM)."""
    response = await client.get("/api/matrix/health")
    # Without OSRM running, should be 503, not 404
    assert response.status_code in (200, 503)


async def test_coordinate_dataclass() -> None:
    """Coordinate dataclass should be frozen and store lon/lat."""
    c = Coordinate(lon=139.817, lat=35.672)
    assert c.lon == 139.817
    assert c.lat == 35.672


async def test_cache_key_deterministic() -> None:
    """Cache keys should be deterministic for the same input."""
    from app.services.cache import _cache_key

    key1 = _cache_key("test", {"a": 1, "b": 2})
    key2 = _cache_key("test", {"b": 2, "a": 1})
    key3 = _cache_key("test", {"a": 1, "b": 3})

    assert key1 == key2  # Same data, different order
    assert key1 != key3  # Different data


async def test_cache_key_prefix() -> None:
    """Cache keys should include the prefix."""
    from app.services.cache import _cache_key

    key = _cache_key("matrix", {"x": 1})
    assert key.startswith("takumi:matrix:")
