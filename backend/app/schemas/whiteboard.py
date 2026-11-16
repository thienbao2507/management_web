from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalize_title(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("Title must be a string")
    title = value.strip()
    if not title:
        raise ValueError("Title cannot be empty")
    if len(title) > 255:
        raise ValueError("Title cannot exceed 255 characters")
    return title


class WhiteboardCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str = Field(min_length=1, max_length=36)
    title: str

    @field_validator("project_id", mode="before")
    @classmethod
    def trim_project_id(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("title", mode="before")
    @classmethod
    def validate_title(cls, value: Any) -> str:
        return normalize_title(value)


class WhiteboardRename(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str

    @field_validator("title", mode="before")
    @classmethod
    def validate_title(cls, value: Any) -> str:
        return normalize_title(value)


class WhiteboardSceneUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scene: dict[str, Any]
    base_version: int = Field(ge=1)


class WhiteboardSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    version: int
    created_at: datetime
    updated_at: datetime
    updated_by_name: str | None


class WhiteboardDetail(WhiteboardSummary):
    scene: dict[str, Any]


class WhiteboardListResponse(BaseModel):
    items: list[WhiteboardSummary]


class WhiteboardSceneSaveResponse(BaseModel):
    id: str
    version: int
    updated_at: datetime
