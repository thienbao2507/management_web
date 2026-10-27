"""add_project_resources

Revision ID: 9b8a6d3f4e21
Revises: 123263086b0a
Create Date: 2026-10-26 14:20:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "9b8a6d3f4e21"
down_revision: Union[str, Sequence[str], None] = "123263086b0a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


RESOURCE_TYPES = (
    "Website",
    "Google Docs",
    "Google Sheets",
    "Google Drive",
    "Canva",
    "Word",
    "GitHub",
    "Other",
)


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    allowed_types = ", ".join(f"'{value}'" for value in RESOURCE_TYPES)
    op.create_table(
        "project_resources",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("resource_type", sa.String(length=30), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "keywords",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            f"resource_type IN ({allowed_types})",
            name="ck_project_resources_resource_type",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_project_resources_created_at",
        "project_resources",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "ix_project_resources_project_created_at",
        "project_resources",
        ["project_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_project_resources_type_created_at",
        "project_resources",
        ["resource_type", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index(
        "ix_project_resources_type_created_at", table_name="project_resources"
    )
    op.drop_index(
        "ix_project_resources_project_created_at", table_name="project_resources"
    )
    op.drop_index(
        "ix_project_resources_created_at", table_name="project_resources"
    )
    op.drop_table("project_resources")
