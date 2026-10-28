import re
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, field_validator
from app.schemas.project_resource import normalize_optional_text, normalize_required_text, validate_http_url

AvatarKey = Literal["owl", "fish", "cat", "panda", "hedgehog", "robot"]


class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str
    email: str | None = None
    job_title: str | None = None
    custom_avatar_url: str | None = None

    @field_validator("display_name", mode="before")
    @classmethod
    def name_valid(cls, value):
        return normalize_required_text(value, max_length=255, field_name="Display name")

    @field_validator("email", mode="before")
    @classmethod
    def email_valid(cls, value):
        value = normalize_optional_text(value, max_length=254, field_name="Email")
        if value and not re.fullmatch(r"[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+", value):
            raise ValueError("Email must be a valid email address (not verified)")
        return value

    @field_validator("job_title", mode="before")
    @classmethod
    def job_valid(cls, value):
        return normalize_optional_text(value, max_length=150, field_name="Job title")

    @field_validator("custom_avatar_url", mode="before")
    @classmethod
    def avatar_valid(cls, value):
        value = normalize_optional_text(value, max_length=2048, field_name="Custom avatar URL")
        return validate_http_url(value) if value else None


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str | None = None
    job_title: str | None = None
    custom_avatar_url: str | None = None

    @field_validator("display_name", mode="before")
    @classmethod
    def name_valid(cls, value):
        return normalize_required_text(value, max_length=255, field_name="Display name") if value is not None else None

    @field_validator("job_title", mode="before")
    @classmethod
    def job_valid(cls, value):
        return normalize_optional_text(value, max_length=150, field_name="Job title")

    @field_validator("custom_avatar_url", mode="before")
    @classmethod
    def avatar_valid(cls, value):
        value = normalize_optional_text(value, max_length=2048, field_name="Custom avatar URL")
        return validate_http_url(value) if value else None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    display_name: str
    email: str | None
    job_title: str | None
    default_avatar_key: AvatarKey
    custom_avatar_url: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    page_size: int
