"""add organizations + multi-tenancy (organization_id on tenant entities)

Revision ID: b2f1a9c4d7e3
Revises: f34dff938c10
Create Date: 2026-06-14 00:00:00.000000

Adds the Organization tenant boundary and an ``organization_id`` foreign key
to every tenant-owned table. Existing rows are backfilled into a default
organization so the migration is non-destructive on dev data.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b2f1a9c4d7e3"
down_revision: str | None = "f34dff938c10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Fixed UUID for the backfill organization that adopts pre-migration rows.
_DEFAULT_ORG_ID = "00000000-0000-0000-0000-0000000000aa"

_TENANT_TABLES = ("users", "depots", "vehicles", "stops", "orders")


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Seed the default organization that pre-existing rows are backfilled into.
    # Casts are explicit because asyncpg will not coerce text → uuid.
    op.execute(
        sa.text(
            "INSERT INTO organizations (id, name) VALUES (CAST(:id AS uuid), :name)"
        ).bindparams(id=_DEFAULT_ORG_ID, name="Default Organization")
    )

    for table in _TENANT_TABLES:
        op.add_column(table, sa.Column("organization_id", sa.Uuid(), nullable=True))
        op.execute(
            sa.text(
                f"UPDATE {table} SET organization_id = CAST(:org AS uuid) "  # noqa: S608 — fixed table name
                "WHERE organization_id IS NULL"
            ).bindparams(org=_DEFAULT_ORG_ID)
        )
        op.alter_column(table, "organization_id", nullable=False)
        op.create_foreign_key(
            f"fk_{table}_organization_id",
            table,
            "organizations",
            ["organization_id"],
            ["id"],
        )
        op.create_index(
            f"ix_{table}_organization_id", table, ["organization_id"], unique=False
        )


def downgrade() -> None:
    for table in _TENANT_TABLES:
        op.drop_index(f"ix_{table}_organization_id", table_name=table)
        op.drop_constraint(f"fk_{table}_organization_id", table, type_="foreignkey")
        op.drop_column(table, "organization_id")
    op.drop_table("organizations")
