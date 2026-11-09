"""add_google_forms_resource_type

Revision ID: d61f01d5e003
Revises: c51f01d5e002
Create Date: 2026-11-09 00:00:00

"""
from typing import Sequence, Union

from alembic import op


revision: str = "d61f01d5e003"
down_revision: Union[str, Sequence[str], None] = "c51f01d5e002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


OLD_RESOURCE_TYPES = (
    "Website",
    "Google Docs",
    "Google Sheets",
    "Google Drive",
    "Canva",
    "Word",
    "GitHub",
    "Other",
)

NEW_RESOURCE_TYPES = (
    "Website",
    "Google Docs",
    "Google Sheets",
    "Google Forms",
    "Google Drive",
    "Canva",
    "Word",
    "GitHub",
    "Other",
)


def _resource_type_check(resource_types: tuple[str, ...]) -> str:
    allowed_types = ", ".join(f"'{value}'" for value in resource_types)
    return f"resource_type IN ({allowed_types})"


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(
        "ck_project_resources_resource_type",
        "project_resources",
        type_="check",
    )
    op.create_check_constraint(
        "ck_project_resources_resource_type",
        "project_resources",
        _resource_type_check(NEW_RESOURCE_TYPES),
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(
        "UPDATE project_resources SET resource_type = 'Other' "
        "WHERE resource_type = 'Google Forms'"
    )
    op.drop_constraint(
        "ck_project_resources_resource_type",
        "project_resources",
        type_="check",
    )
    op.create_check_constraint(
        "ck_project_resources_resource_type",
        "project_resources",
        _resource_type_check(OLD_RESOURCE_TYPES),
    )
