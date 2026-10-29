import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.project_resource import normalize_required_text
from app.schemas.user import UserResponse


EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$")


def normalize_login_email(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("Email must be a string")
    normalized = value.strip().lower()
    if not normalized or len(normalized) > 254 or not EMAIL_PATTERN.fullmatch(normalized):
        raise ValueError("Email must be a valid email address")
    return normalized


def validate_password(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("Password must be a string")
    if len(value) < 8 or len(value) > 128:
        raise ValueError("Password must be between 8 and 128 characters")
    return value


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str
    email: str
    password: str

    @field_validator("display_name", mode="before")
    @classmethod
    def valid_name(cls, value: Any) -> str:
        return normalize_required_text(value, max_length=255, field_name="Display name")

    @field_validator("email", mode="before")
    @classmethod
    def valid_email(cls, value: Any) -> str:
        return normalize_login_email(value)

    @field_validator("password", mode="before")
    @classmethod
    def valid_password(cls, value: Any) -> str:
        return validate_password(value)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def valid_email(cls, value: Any) -> str:
        return normalize_login_email(value)


class VerifyEmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=32, max_length=256)


class ResendVerificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str

    @field_validator("email", mode="before")
    @classmethod
    def valid_email(cls, value: Any) -> str:
        return normalize_login_email(value)


class AuthMessageResponse(BaseModel):
    message: str


class RegisterResponse(BaseModel):
    status: Literal["pending_verification", "completed"]
    message: str
    email_delivery: Literal["sent", "failed", "not_configured"] = "not_configured"


class AuthSessionResponse(BaseModel):
    user: UserResponse
    csrf_header: str = "X-CSRF-Token"


class CurrentAuthResponse(BaseModel):
    user: UserResponse
    csrf_header: str = "X-CSRF-Token"
    authenticated: bool = True
