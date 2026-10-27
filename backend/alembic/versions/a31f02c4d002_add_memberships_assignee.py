"""Project memberships and nullable user assignment; no legacy backfill.

Revision ID: a31f02c4d002
Revises: a31f01c4d001
"""
from alembic import op
import sqlalchemy as sa

revision = "a31f02c4d002"
down_revision = "a31f01c4d001"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table("project_memberships",
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_project_memberships_user_id", "project_memberships", ["user_id"])
    op.add_column("tasks", sa.Column("assignee_id", sa.String(36), nullable=True))
    op.create_foreign_key("fk_tasks_assignee_id_users", "tasks", "users", ["assignee_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_tasks_assignee_id", "tasks", ["assignee_id"])


def downgrade():
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index("ix_tasks_assignee_id", table_name="tasks")
    op.drop_constraint("fk_tasks_assignee_id_users", "tasks", type_="foreignkey")
    op.drop_column("tasks", "assignee_id")
    op.drop_index("ix_project_memberships_user_id", table_name="project_memberships")
    op.drop_table("project_memberships")
