"""Vehicle model — delivery vehicle assigned to a depot."""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.depot import Depot


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, default=uuid.uuid4
    )
    depot_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("depots.id"), nullable=False
    )
    capacity: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    max_route_seconds: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    cost_per_second: Mapped[Decimal] = mapped_column(
        sa.Numeric(10, 6), nullable=False
    )
    active: Mapped[bool] = mapped_column(sa.Boolean, default=True, nullable=False)

    depot: Mapped[Depot] = relationship(back_populates="vehicles")

    def __repr__(self) -> str:
        return f"<Vehicle {self.id} cap={self.capacity}>"
