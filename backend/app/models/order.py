"""Order model — a parcel to be delivered to a stop."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.enums import OrderStatus, ParcelSize

if TYPE_CHECKING:
    from app.models.slot import Slot
    from app.models.stop import Stop


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    stop_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("stops.id"), nullable=False
    )
    parcel_size: Mapped[ParcelSize] = mapped_column(
        sa.Enum(ParcelSize, name="parcel_size", native_enum=False),
        nullable=False,
    )
    demand: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=1)
    status: Mapped[OrderStatus] = mapped_column(
        sa.Enum(OrderStatus, name="order_status", native_enum=False),
        nullable=False,
        default=OrderStatus.PENDING,
    )
    assigned_slot_code: Mapped[str | None] = mapped_column(
        sa.String(10), sa.ForeignKey("slots.code"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    stop: Mapped[Stop] = relationship(back_populates="orders")
    assigned_slot: Mapped[Slot | None] = relationship()

    def __repr__(self) -> str:
        return f"<Order {self.id} status={self.status}>"
