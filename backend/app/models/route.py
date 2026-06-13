"""Route model — a vehicle's delivery route for a simulation run."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.enums import RoutePolicy, RouteStatus

if TYPE_CHECKING:
    from app.models.route_stop import RouteStop
    from app.models.simulation_run import SimulationRun
    from app.models.vehicle import Vehicle


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, default=uuid.uuid4
    )
    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("vehicles.id"), nullable=False
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("simulation_runs.id"), nullable=False
    )
    policy: Mapped[RoutePolicy] = mapped_column(
        sa.Enum(RoutePolicy, name="route_policy", native_enum=False),
        nullable=False,
    )
    total_seconds: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    status: Mapped[RouteStatus] = mapped_column(
        sa.Enum(RouteStatus, name="route_status", native_enum=False),
        nullable=False,
        default=RouteStatus.PENDING,
    )

    vehicle: Mapped[Vehicle] = relationship()
    simulation_run: Mapped[SimulationRun] = relationship(back_populates="routes")
    route_stops: Mapped[list[RouteStop]] = relationship(back_populates="route")

    def __repr__(self) -> str:
        return f"<Route {self.id} policy={self.policy}>"
