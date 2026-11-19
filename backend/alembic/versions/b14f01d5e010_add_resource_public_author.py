"""add_resource_public_author

Revision ID: b14f01d5e010
Revises: a13f01d5e009
Create Date: 2026-11-19 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b14f01d5e010"
down_revision: Union[str, Sequence[str], None] = "a13f01d5e009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "project_resources",
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
    )
    op.add_column(
        "project_resources",
        sa.Column(
            "is_public",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.create_foreign_key(
        "fk_project_resources_created_by_user_id_users",
        "project_resources",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_project_resources_url", "project_resources", ["url"])
    op.create_index(
        "ix_project_resources_public_created",
        "project_resources",
        ["is_public", "created_at"],
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index("ix_project_resources_public_created", table_name="project_resources")
    op.drop_index("ix_project_resources_url", table_name="project_resources")
    op.drop_constraint(
        "fk_project_resources_created_by_user_id_users",
        "project_resources",
        type_="foreignkey",
    )
    op.drop_column("project_resources", "is_public")
    op.drop_column("project_resources", "created_by_user_id")
