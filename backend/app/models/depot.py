"""Depot model — delivery hub with shift hours and PostGIS location."""

from __future__ import annotations

import uuid
from datetime import time
from typing import TYPE_CHECKING

import sqlalchemy as sa
from geoalchemy2 import Geography
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.vehicle import Vehicle


class Depot(Base):
    __tablename__ = "depots"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    location: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=True),
        nullable=False,
    )
    shift_start: Mapped[time] = mapped_column(sa.Time, nullable=False)
    shift_end: Mapped[time] = mapped_column(sa.Time, nullable=False)

    vehicles: Mapped[list[Vehicle]] = relationship(back_populates="depot")

    def __repr__(self) -> str:
        return f"<Depot {self.name}>"
