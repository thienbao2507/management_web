"""add_request_users

Revision ID: e71f01d5e004
Revises: d61f01d5e003
Create Date: 2026-11-15 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e71f01d5e004"
down_revision: Union[str, Sequence[str], None] = "d61f01d5e003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "request_users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("category", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "images",
            sa.JSON(),
            server_default=sa.text("'[]'::json"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "category IN ('bug', 'feature', 'other')",
            name="ck_request_users_category",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_request_users_user_id",
        "request_users",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_request_users_created_at",
        "request_users",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index("ix_request_users_created_at", table_name="request_users")
    op.drop_index("ix_request_users_user_id", table_name="request_users")
    op.drop_table("request_users")
