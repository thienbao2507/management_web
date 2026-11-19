"""add_user_backgrounds

Revision ID: a13f01d5e009
Revises: c03f01d5e008
Create Date: 2026-11-19 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a13f01d5e009"
down_revision: Union[str, Sequence[str], None] = "c03f01d5e008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "user_backgrounds",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("image", sa.Text(), nullable=False),
        sa.Column(
            "dim",
            sa.Integer(),
            server_default=sa.text("40"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "dim BETWEEN 0 AND 80",
            name="ck_user_backgrounds_dim",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_table("user_backgrounds")
