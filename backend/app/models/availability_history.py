"""Availability history — ML training source for home-probability prediction."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.stop import Stop


class AvailabilityHistory(Base):
    __tablename__ = "availability_history"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, default=uuid.uuid4
    )
    stop_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("stops.id"), nullable=False
    )
    slot_code: Mapped[str] = mapped_column(sa.String(10), nullable=False)
    day_of_week: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    attempt_ts: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False
    )
    was_home: Mapped[bool] = mapped_column(sa.Boolean, nullable=False)

    stop: Mapped[Stop] = relationship()

    __table_args__ = (
        sa.Index("ix_availability_stop_slot", "stop_id", "slot_code"),
    )

    def __repr__(self) -> str:
        return f"<AvailabilityHistory stop={self.stop_id} slot={self.slot_code} home={self.was_home}>"
