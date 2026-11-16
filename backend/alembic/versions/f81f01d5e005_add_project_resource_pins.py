"""add_project_resource_pins

Revision ID: f81f01d5e005
Revises: e71f01d5e004
Create Date: 2026-11-16 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f81f01d5e005"
down_revision: Union[str, Sequence[str], None] = "e71f01d5e004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "project_resource_pins",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("resource_id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["resource_id"],
            ["project_resources.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "resource_id"),
    )
    op.create_index(
        "ix_project_resource_pins_resource_id",
        "project_resource_pins",
        ["resource_id"],
        unique=False,
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_table("project_resource_pins")
