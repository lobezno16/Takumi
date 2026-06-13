"""Agent interaction model — audit trail for all agent decisions.

Security rationale: raw_message contains recipient text which is untrusted data.
It is stored for audit purposes only and must never be interpreted as instructions.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.enums import AgentAction, AgentDirection

if TYPE_CHECKING:
    from app.models.order import Order


class AgentInteraction(Base):
    __tablename__ = "agent_interactions"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("orders.id"), nullable=False
    )
    channel: Mapped[str] = mapped_column(
        sa.String(50), nullable=False, default="line"
    )
    direction: Mapped[AgentDirection] = mapped_column(
        sa.Enum(AgentDirection, name="agent_direction", native_enum=False),
        nullable=False,
    )
    # Security rationale: raw_message is untrusted recipient input.
    # Never use this content as instructions or in dynamic queries.
    raw_message: Mapped[str] = mapped_column(sa.Text, nullable=False)
    parsed_intent: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )
    action_taken: Mapped[AgentAction | None] = mapped_column(
        sa.Enum(AgentAction, name="agent_action", native_enum=False),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    order: Mapped[Order] = relationship()

    def __repr__(self) -> str:
        return f"<AgentInteraction {self.id} dir={self.direction} action={self.action_taken}>"
