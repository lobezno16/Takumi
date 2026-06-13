"""TakumiRoute ORM models — import all models so Base.metadata is complete.

Import order matters: models with no FK dependencies first, then dependent ones.
"""
from __future__ import annotations

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
from app.models.user import User
from app.models.slot import SEED_SLOTS, Slot
from app.models.depot import Depot
from app.models.vehicle import Vehicle
from app.models.stop import Stop
from app.models.order import Order
from app.models.availability_history import AvailabilityHistory
from app.models.simulation_run import SimulationRun
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.agent_interaction import AgentInteraction

__all__ = [
    "AgentInteraction",
    "AvailabilityHistory",
    "Depot",
    "Order",
    "Route",
    "RouteStop",
    "SimulationRun",
    "Slot",
    "SEED_SLOTS",
    "Stop",
    "User",
    "Vehicle",
    "AddressType",
    "AgentAction",
    "AgentDirection",
    "OrderStatus",
    "ParcelSize",
    "RoutePolicy",
    "RouteStatus",
    "SlotCode",
    "StopOutcome",
    "UserRole",
]
