import base64
import binascii
import re
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator


MAX_AVATAR_IMAGE_BYTES = 200 * 1024
AVATAR_IMAGE_DATA_URL_PATTERN = re.compile(
    r"^data:image/(webp|jpeg|png);base64,([A-Za-z0-9+/]*={0,2})$"
)


class UserAvatarUpload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image: str

    @field_validator("image", mode="before")
    @classmethod
    def validate_image(cls, value: Any) -> str:
        if not isinstance(value, str):
            raise ValueError("Avatar image must be a data URL string")

        match = AVATAR_IMAGE_DATA_URL_PATTERN.fullmatch(value)
        if match is None:
            raise ValueError(
                "Avatar image must be a valid WebP, JPEG, or PNG data URL"
            )

        try:
            decoded = base64.b64decode(match.group(2), validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Avatar image contains invalid base64 data") from exc

        if len(decoded) > MAX_AVATAR_IMAGE_BYTES:
            raise ValueError("Avatar image must not exceed 200 KB")

        return value


class UserAvatarResponse(BaseModel):
    custom_avatar_url: str
