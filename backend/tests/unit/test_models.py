"""Tests for Phase 1 — Data Layer: models, migration, and seed data."""

from __future__ import annotations

from httpx import AsyncClient


async def test_health_still_works(client: AsyncClient) -> None:
    """Ensure Phase 0 health endpoint survives Phase 1 changes."""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_all_models_importable() -> None:
    """All ORM models should import without errors."""
    from app.models import (
        AgentInteraction,
        AvailabilityHistory,
        Depot,
        Order,
        Route,
        RouteStop,
        SimulationRun,
        Slot,
        Stop,
        User,
        Vehicle,
    )

    # Verify each model has __tablename__
    assert User.__tablename__ == "users"
    assert Depot.__tablename__ == "depots"
    assert Vehicle.__tablename__ == "vehicles"
    assert Slot.__tablename__ == "slots"
    assert Stop.__tablename__ == "stops"
    assert Order.__tablename__ == "orders"
    assert AvailabilityHistory.__tablename__ == "availability_history"
    assert SimulationRun.__tablename__ == "simulation_runs"
    assert Route.__tablename__ == "routes"
    assert RouteStop.__tablename__ == "route_stops"
    assert AgentInteraction.__tablename__ == "agent_interactions"


async def test_all_enums_importable() -> None:
    """All domain enums should import and have expected members."""
    from app.models.enums import (
        AddressType,
        AgentAction,
        AgentDirection,
        OrderStatus,
        ParcelSize,
        RoutePolicy,
        RouteStatus,
        SlotCode,
        StopOutcome,
        UserRole,
    )

    assert UserRole.OPERATOR.value == "operator"
    assert UserRole.ADMIN.value == "admin"
    assert len(SlotCode) == 5
    assert ParcelSize.S60.value == "60"
    assert OrderStatus.PENDING.value == "pending"
    assert AddressType.APARTMENT.value == "apartment"
    assert RoutePolicy.TAKUMI.value == "takumi"
    assert RouteStatus.COMPLETED.value == "completed"
    assert StopOutcome.SUCCESS.value == "success"
    assert AgentDirection.IN.value == "in"
    assert AgentAction.PROPOSE_WINDOW.value == "propose_window"


async def test_seed_slots_data() -> None:
    """SEED_SLOTS should contain exactly 5 standard Japanese courier windows."""
    from app.models.slot import SEED_SLOTS

    assert len(SEED_SLOTS) == 5
    codes = [s["code"] for s in SEED_SLOTS]
    assert codes == ["am", "t1214", "t1416", "t1618", "t1821"]

    # AM slot: midnight to noon
    am = SEED_SLOTS[0]
    assert am["start_min"] == 0
    assert am["end_min"] == 720

    # Last slot: 18:00-21:00
    last = SEED_SLOTS[-1]
    assert last["start_min"] == 1080
    assert last["end_min"] == 1260


async def test_schemas_extra_forbid() -> None:
    """All Pydantic schemas with extra='forbid' should reject extra fields."""
    import pytest
    from pydantic import ValidationError

    from app.schemas import OrderCreate, StopCreate, UserCreate

    with pytest.raises(ValidationError):
        UserCreate(email="test@test.com", password="12345678", extra_field="bad")

    with pytest.raises(ValidationError):
        OrderCreate(
            stop_id="00000000-0000-0000-0000-000000000000",
            parcel_size="60",
            demand=1,
            extra_field="bad",
        )

    with pytest.raises(ValidationError):
        StopCreate(
            address="Tokyo",
            latitude=35.6,
            longitude=139.7,
            address_type="apartment",
            extra_field="bad",
        )


async def test_schema_field_validation() -> None:
    """Pydantic schemas should enforce field bounds."""
    import pytest
    from pydantic import ValidationError

    from app.schemas import UserCreate, VehicleCreate

    # Password too short
    with pytest.raises(ValidationError):
        UserCreate(email="test@test.com", password="short")

    # Capacity must be > 0
    with pytest.raises(ValidationError):
        VehicleCreate(
            depot_id="00000000-0000-0000-0000-000000000000",
            capacity=0,
            max_route_seconds=3600,
            cost_per_second=0.01,
        )


async def test_base_metadata_has_all_tables() -> None:
    """Base.metadata should contain all 11 application tables."""
    import app.models  # noqa: F401
    from app.db import Base

    table_names = set(Base.metadata.tables.keys())
    expected = {
        "users",
        "depots",
        "vehicles",
        "slots",
        "stops",
        "orders",
        "availability_history",
        "simulation_runs",
        "routes",
        "route_stops",
        "agent_interactions",
    }
    assert expected.issubset(table_names), f"Missing: {expected - table_names}"
