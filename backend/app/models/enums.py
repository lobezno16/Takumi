"""Shared enums for TakumiRoute domain models."""

from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    """User authorization roles."""

    OPERATOR = "operator"
    ADMIN = "admin"


class OrderStatus(str, enum.Enum):
    """Lifecycle status of a delivery order."""

    PENDING = "pending"
    ASSIGNED = "assigned"
    DELIVERED = "delivered"
    REDELIVERY = "redelivery"


class ParcelSize(str, enum.Enum):
    """Standard Japanese parcel size classes (cm)."""

    S60 = "60"
    S80 = "80"
    S100 = "100"
    S120 = "120"


class AddressType(str, enum.Enum):
    """Residential address classification."""

    APARTMENT = "apartment"
    HOUSE = "house"


class RoutePolicy(str, enum.Enum):
    """Routing policy used in a simulation run."""

    BASELINE = "baseline"
    TAKUMI = "takumi"


class RouteStatus(str, enum.Enum):
    """Lifecycle status of a computed route."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"


class StopOutcome(str, enum.Enum):
    """Outcome of a delivery attempt at a stop."""

    SUCCESS = "success"
    MISS = "miss"


class AgentDirection(str, enum.Enum):
    """Direction of an agent interaction message."""

    IN = "in"
    OUT = "out"


class AgentAction(str, enum.Enum):
    """Allowlisted actions the agent may take."""

    PROPOSE_WINDOW = "propose_window"
    CONFIRM_DELIVERY = "confirm_delivery"
    REQUEST_REPLAN = "request_replan"
    NO_ACTION = "no_action"


class SlotCode(str, enum.Enum):
    """Japanese courier delivery time-slot codes."""

    AM = "am"
    T1214 = "t1214"
    T1416 = "t1416"
    T1618 = "t1618"
    T1821 = "t1821"
