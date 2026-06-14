"""TakumiRoute ORM models — import all models so Base.metadata is complete.

Import order matters: models with no FK dependencies first, then dependent ones.
"""

from __future__ import annotations

from app.models.agent_interaction import AgentInteraction
from app.models.availability_history import AvailabilityHistory
from app.models.depot import Depot
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
from app.models.order import Order
from app.models.organization import Organization
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.simulation_run import SimulationRun
from app.models.slot import SEED_SLOTS, Slot
from app.models.stop import Stop
from app.models.user import User
from app.models.vehicle import Vehicle

__all__ = [
    "SEED_SLOTS",
    "AddressType",
    "AgentAction",
    "AgentDirection",
    "AgentInteraction",
    "AvailabilityHistory",
    "Depot",
    "Order",
    "OrderStatus",
    "Organization",
    "ParcelSize",
    "Route",
    "RoutePolicy",
    "RouteStatus",
    "RouteStop",
    "SimulationRun",
    "Slot",
    "SlotCode",
    "Stop",
    "StopOutcome",
    "User",
    "UserRole",
    "Vehicle",
]
