from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.project_resource import normalize_optional_text, normalize_required_text


class WorkspaceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: Any) -> str:
        return normalize_required_text(value, max_length=255, field_name="Workspace name")

    @field_validator("description", mode="before")
    @classmethod
    def validate_description(cls, value: Any) -> str | None:
        return normalize_optional_text(value, max_length=2000, field_name="Description")


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_user_id: str
    name: str
    description: str | None
    workspace_type: Literal["personal"]
    created_at: datetime
    updated_at: datetime
