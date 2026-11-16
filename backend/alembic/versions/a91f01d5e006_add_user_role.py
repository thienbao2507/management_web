"""add_user_role

Revision ID: a91f01d5e006
Revises: f81f01d5e005
Create Date: 2026-11-16 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a91f01d5e006"
down_revision: Union[str, Sequence[str], None] = "f81f01d5e005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "users",
        sa.Column(
            "role",
            sa.String(length=20),
            server_default=sa.text("'user'"),
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('admin','user')",
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_column("users", "role")
