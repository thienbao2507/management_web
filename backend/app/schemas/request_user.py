import base64
import binascii
import re
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


MAX_FEEDBACK_IMAGE_BYTES = 900 * 1024
IMAGE_DATA_URL_PATTERN = re.compile(
    r"^data:image/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/]*={0,2})$"
)


class FeedbackCategory(str, Enum):
    BUG = "bug"
    FEATURE = "feature"
    OTHER = "other"


class FeedbackStatus(str, Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    REJECTED = "rejected"


class RequestUserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: FeedbackCategory
    content: str
    images: list[str] = Field(default_factory=list, max_length=3)

    @field_validator("content", mode="before")
    @classmethod
    def validate_content(cls, value: Any) -> str:
        if not isinstance(value, str):
            raise ValueError("Feedback content must be a string")
        content = value.strip()
        if not content:
            raise ValueError("Feedback content cannot be empty")
        if len(content) > 5000:
            raise ValueError("Feedback content cannot exceed 5000 characters")
        return content

    @field_validator("images", mode="before")
    @classmethod
    def validate_images(cls, value: Any) -> list[str]:
        if not isinstance(value, list):
            raise ValueError("Feedback images must be a list")
        if len(value) > 3:
            raise ValueError("Feedback can include at most 3 images")

        for image in value:
            if not isinstance(image, str):
                raise ValueError("Each feedback image must be a data URL string")
            match = IMAGE_DATA_URL_PATTERN.fullmatch(image)
            if match is None:
                raise ValueError(
                    "Feedback images must be valid PNG, JPEG, WebP, or GIF data URLs"
                )
            try:
                decoded = base64.b64decode(match.group(1), validate=True)
            except (binascii.Error, ValueError) as exc:
                raise ValueError("Feedback image contains invalid base64 data") from exc
            if len(decoded) > MAX_FEEDBACK_IMAGE_BYTES:
                raise ValueError("Each feedback image must not exceed 900 KB")

        return value


class RequestUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    category: FeedbackCategory
    created_at: datetime


class MyFeedback(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    category: FeedbackCategory
    content: str
    status: FeedbackStatus
    created_at: datetime
    updated_at: datetime


class MyFeedbackListResponse(BaseModel):
    items: list[MyFeedback]


class AdminFeedbackUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    email: str | None


class AdminFeedbackSummary(BaseModel):
    id: str
    category: FeedbackCategory
    content: str
    status: FeedbackStatus
    admin_note: str | None
    image_count: int
    created_at: datetime
    updated_at: datetime
    user: AdminFeedbackUser | None


class AdminFeedbackDetail(AdminFeedbackSummary):
    images: list[str]


class AdminFeedbackCounts(BaseModel):
    new: int = 0
    in_progress: int = 0
    done: int = 0
    rejected: int = 0


class AdminFeedbackListResponse(BaseModel):
    items: list[AdminFeedbackSummary]
    total: int
    page: int
    page_size: int
    counts: AdminFeedbackCounts


class AdminFeedbackUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: FeedbackStatus | None = None
    admin_note: str | None = Field(default=None, max_length=5000)

    @field_validator("admin_note", mode="before")
    @classmethod
    def normalize_admin_note(cls, value: Any) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Admin note must be a string or null")
        return value.strip() or None
