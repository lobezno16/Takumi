"""Pydantic schemas for TakumiRoute API — all use extra='forbid'."""
from __future__ import annotations

import uuid
from datetime import datetime, time
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

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


# ── Slots ──────────────────────────────────────────────────────────────

class SlotResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: SlotCode
    start_min: int = Field(ge=0, le=1440)
    end_min: int = Field(ge=0, le=1440)


# ── Users ──────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(max_length=320)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(max_length=320)
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    email: str
    role: UserRole
    created_at: datetime


# ── Depots ─────────────────────────────────────────────────────────────

class DepotCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(max_length=200)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    shift_start: time
    shift_end: time


class DepotResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    name: str
    latitude: float
    longitude: float
    shift_start: time
    shift_end: time


# ── Vehicles ───────────────────────────────────────────────────────────

class VehicleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    depot_id: uuid.UUID
    capacity: int = Field(gt=0, le=200)
    max_route_seconds: int = Field(gt=0, le=86400)
    cost_per_second: float = Field(ge=0)
    active: bool = True


class VehicleResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    depot_id: uuid.UUID
    capacity: int
    max_route_seconds: int
    cost_per_second: float
    active: bool


# ── Stops ──────────────────────────────────────────────────────────────

class StopCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    address: str = Field(max_length=500)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    address_type: AddressType
    floor: int | None = Field(default=None, ge=0, le=100)


class StopResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    address: str
    address_type: AddressType
    floor: int | None


# ── Orders ─────────────────────────────────────────────────────────────

class OrderCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stop_id: uuid.UUID
    parcel_size: ParcelSize
    demand: int = Field(default=1, ge=1, le=10)


class OrderResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    stop_id: uuid.UUID
    parcel_size: ParcelSize
    demand: int
    status: OrderStatus
    assigned_slot_code: str | None
    created_at: datetime


class OrderStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: OrderStatus


# ── Simulation ─────────────────────────────────────────────────────────

class SimulationRunCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ward: str = Field(max_length=100)
    seed: int = Field(ge=0)
    params: dict[str, Any] | None = None


class SimulationMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")
    baseline_redelivery_rate: float
    takumi_redelivery_rate: float
    baseline_driver_seconds: float
    takumi_driver_seconds: float
    co2_baseline_g: float
    co2_takumi_g: float


class SimulationRunResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    ward: str
    seed: int
    params: dict[str, Any] | None
    baseline_redelivery_rate: float | None
    takumi_redelivery_rate: float | None
    baseline_driver_seconds: float | None
    takumi_driver_seconds: float | None
    co2_baseline_g: float | None
    co2_takumi_g: float | None
    created_at: datetime


# ── Routes ─────────────────────────────────────────────────────────────

class RouteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    vehicle_id: uuid.UUID
    run_id: uuid.UUID
    policy: RoutePolicy
    total_seconds: float | None
    status: RouteStatus


class RouteStopResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    route_id: uuid.UUID
    stop_id: uuid.UUID
    sequence: int
    planned_arrival_min: int | None
    assigned_slot_code: str | None
    predicted_home_prob: float | None
    actual_outcome: StopOutcome | None


# ── Agent ──────────────────────────────────────────────────────────────

class AgentMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    order_id: uuid.UUID
    message: str = Field(max_length=2000)


class CandidateSlot(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slot_code: SlotCode
    predicted_prob: float = Field(ge=0, le=1)


class CandidateSlotsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    order_id: uuid.UUID
    slots: list[CandidateSlot]


class AgentInteractionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    order_id: uuid.UUID
    channel: str
    direction: AgentDirection
    raw_message: str
    parsed_intent: dict[str, Any] | None
    action_taken: AgentAction | None
    created_at: datetime
