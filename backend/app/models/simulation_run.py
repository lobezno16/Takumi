"""Simulation run model — stores parameters and results for baseline vs TakumiRoute."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.route import Route


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    params: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    ward: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    seed: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    baseline_redelivery_rate: Mapped[float | None] = mapped_column(
        sa.Float, nullable=True
    )
    takumi_redelivery_rate: Mapped[float | None] = mapped_column(
        sa.Float, nullable=True
    )
    baseline_driver_seconds: Mapped[float | None] = mapped_column(
        sa.Float, nullable=True
    )
    takumi_driver_seconds: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    co2_baseline_g: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    co2_takumi_g: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    routes: Mapped[list[Route]] = relationship(back_populates="simulation_run")

    def __repr__(self) -> str:
        return f"<SimulationRun {self.id} ward={self.ward} seed={self.seed}>"
