"""User model — authentication only, not tenancy."""
from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        sa.String(320), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(sa.String(256), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        sa.Enum(UserRole, name="user_role", native_enum=False),
        nullable=False,
        default=UserRole.OPERATOR,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    def __repr__(self) -> str:
        return f"<User {self.email} role={self.role}>"
