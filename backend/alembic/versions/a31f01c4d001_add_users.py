"""User data foundation; no authentication or seeded identities.

Revision ID: a31f01c4d001
Revises: 9b8a6d3f4e21
"""
from alembic import op
import sqlalchemy as sa

revision = "a31f01c4d001"
down_revision = "9b8a6d3f4e21"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table("users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(254), nullable=True),
        sa.Column("job_title", sa.String(150), nullable=True),
        sa.Column("default_avatar_key", sa.String(20), nullable=False),
        sa.Column("custom_avatar_url", sa.String(2048), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("default_avatar_key IN ('owl','fish','cat','panda','hedgehog','robot')", name="ck_users_default_avatar_key"),
    )


def downgrade():
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_table("users")
