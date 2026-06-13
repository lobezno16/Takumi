"""Seed the slots table with the 5 standard Japanese courier time windows."""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

from app.db import async_session_factory
from app.models.slot import SEED_SLOTS, Slot


async def seed_slots() -> None:
    """Insert seed slot rows if they don't already exist."""
    async with async_session_factory() as session:
        for slot_data in SEED_SLOTS:
            existing = await session.execute(
                select(Slot).where(Slot.code == slot_data["code"])
            )
            if existing.scalar_one_or_none() is None:
                session.add(Slot(**slot_data))
        await session.commit()

    print(f"Seeded {len(SEED_SLOTS)} slot rows.")  # noqa: T201 — CLI seed script


if __name__ == "__main__":
    asyncio.run(seed_slots())
    sys.exit(0)
