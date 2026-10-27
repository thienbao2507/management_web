"""Add personal workspaces and nullable project linkage without backfill.

Revision ID: b41f01d5e001
Revises: a31f02c4d002
"""

from alembic import op
import sqlalchemy as sa


revision = "b41f01d5e001"
down_revision = "a31f02c4d002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "workspaces",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_user_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "workspace_type",
            sa.String(20),
            server_default="personal",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "workspace_type IN ('personal')",
            name="ck_workspaces_workspace_type",
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
    )
    op.create_index(
        "ix_workspaces_owner_user_id",
        "workspaces",
        ["owner_user_id"],
        unique=False,
    )
    op.create_index(
        "uq_workspaces_personal_owner",
        "workspaces",
        ["owner_user_id"],
        unique=True,
        postgresql_where=sa.text("workspace_type = 'personal'"),
    )
    op.add_column(
        "projects", sa.Column("workspace_id", sa.String(36), nullable=True)
    )
    op.create_foreign_key(
        "fk_projects_workspace_id_workspaces",
        "projects",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_projects_workspace_id", "projects", ["workspace_id"], unique=False
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index("ix_projects_workspace_id", table_name="projects")
    op.drop_constraint(
        "fk_projects_workspace_id_workspaces",
        "projects",
        type_="foreignkey",
    )
    op.drop_column("projects", "workspace_id")
    op.drop_index("uq_workspaces_personal_owner", table_name="workspaces")
    op.drop_index("ix_workspaces_owner_user_id", table_name="workspaces")
    op.drop_table("workspaces")
