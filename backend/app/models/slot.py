"""Slot model — fixed Japanese courier time windows.

Seed rows: am (00:00–12:00), t1214, t1416, t1618, t1821.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Slot(Base):
    __tablename__ = "slots"

    code: Mapped[str] = mapped_column(sa.String(10), primary_key=True)
    start_min: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    end_min: Mapped[int] = mapped_column(sa.Integer, nullable=False)

    def __repr__(self) -> str:
        return f"<Slot {self.code} {self.start_min}-{self.end_min}>"


# Seed data: the 5 standard Japanese courier delivery windows.
# Stored as dicts to avoid instantiating ORM objects at import time.
SEED_SLOTS: list[dict[str, str | int]] = [
    {"code": "am", "start_min": 0, "end_min": 720},  # –12:00
    {"code": "t1214", "start_min": 720, "end_min": 840},  # 12:00–14:00
    {"code": "t1416", "start_min": 840, "end_min": 960},  # 14:00–16:00
    {"code": "t1618", "start_min": 960, "end_min": 1080},  # 16:00–18:00
    {"code": "t1821", "start_min": 1080, "end_min": 1260},  # 18:00–21:00
]
