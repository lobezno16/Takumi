"""Route stop model — an ordered stop within a vehicle's route."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.enums import StopOutcome

if TYPE_CHECKING:
    from app.models.route import Route
    from app.models.stop import Stop


class RouteStop(Base):
    __tablename__ = "route_stops"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, default=uuid.uuid4
    )
    route_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("routes.id"), nullable=False
    )
    stop_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("stops.id"), nullable=False
    )
    sequence: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    planned_arrival_min: Mapped[int | None] = mapped_column(
        sa.Integer, nullable=True
    )
    assigned_slot_code: Mapped[str | None] = mapped_column(
        sa.String(10), nullable=True
    )
    predicted_home_prob: Mapped[float | None] = mapped_column(
        sa.Float, nullable=True
    )
    actual_outcome: Mapped[StopOutcome | None] = mapped_column(
        sa.Enum(StopOutcome, name="stop_outcome", native_enum=False),
        nullable=True,
    )

    route: Mapped[Route] = relationship(back_populates="route_stops")
    stop: Mapped[Stop] = relationship()

    __table_args__ = (
        sa.UniqueConstraint("route_id", "sequence", name="uq_route_sequence"),
    )

    def __repr__(self) -> str:
        return f"<RouteStop route={self.route_id} seq={self.sequence}>"
