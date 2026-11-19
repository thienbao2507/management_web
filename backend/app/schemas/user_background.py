import base64
import binascii
import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


MAX_BACKGROUND_IMAGE_BYTES = 1536 * 1024
BACKGROUND_IMAGE_DATA_URL_PATTERN = re.compile(
    r"^data:image/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]*={0,2})$"
)


class UserBackgroundSave(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image: str
    dim: int = Field(default=40, ge=0, le=80)

    @field_validator("image", mode="before")
    @classmethod
    def validate_image(cls, value: Any) -> str:
        if not isinstance(value, str):
            raise ValueError("Background image must be a data URL string")

        match = BACKGROUND_IMAGE_DATA_URL_PATTERN.fullmatch(value)
        if match is None:
            raise ValueError(
                "Background image must be a valid PNG, JPEG, or WebP data URL"
            )

        try:
            decoded = base64.b64decode(match.group(1), validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Background image contains invalid base64 data") from exc

        if len(decoded) > MAX_BACKGROUND_IMAGE_BYTES:
            raise ValueError("Background image must not exceed 1.5 MB")

        return value


class UserBackgroundDimUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dim: int = Field(ge=0, le=80)


class UserBackgroundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    image: str
    dim: int
    updated_at: datetime


class UserBackgroundEnvelope(BaseModel):
    background: UserBackgroundResponse | None
