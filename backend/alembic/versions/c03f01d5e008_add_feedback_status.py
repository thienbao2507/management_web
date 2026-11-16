"""add_feedback_status

Revision ID: c03f01d5e008
Revises: b02f01d5e007
Create Date: 2026-11-16 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c03f01d5e008"
down_revision: Union[str, Sequence[str], None] = "b02f01d5e007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "request_users",
        sa.Column(
            "status",
            sa.String(length=20),
            server_default=sa.text("'new'"),
            nullable=False,
        ),
    )
    op.add_column(
        "request_users",
        sa.Column("admin_note", sa.Text(), nullable=True),
    )
    op.add_column(
        "request_users",
        sa.Column(
            "thank_you_pending",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "request_users",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "ck_request_users_status",
        "request_users",
        "status IN ('new', 'in_progress', 'done', 'rejected')",
    )
    op.create_index(
        "ix_request_users_status_created_at",
        "request_users",
        ["status", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index(
        "ix_request_users_status_created_at",
        table_name="request_users",
    )
    op.drop_constraint(
        "ck_request_users_status",
        "request_users",
        type_="check",
    )
    op.drop_column("request_users", "updated_at")
    op.drop_column("request_users", "thank_you_pending")
    op.drop_column("request_users", "admin_note")
    op.drop_column("request_users", "status")
