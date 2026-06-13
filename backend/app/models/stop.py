"""Stop model — delivery destination with PostGIS location."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from geoalchemy2 import Geography
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.enums import AddressType

if TYPE_CHECKING:
    from app.models.order import Order


class Stop(Base):
    __tablename__ = "stops"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    address: Mapped[str] = mapped_column(sa.Text, nullable=False)
    location: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=True),
        nullable=False,
    )
    address_type: Mapped[AddressType] = mapped_column(
        sa.Enum(AddressType, name="address_type", native_enum=False),
        nullable=False,
    )
    floor: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)

    orders: Mapped[list[Order]] = relationship(back_populates="stop")

    def __repr__(self) -> str:
        return f"<Stop {self.id} type={self.address_type}>"
