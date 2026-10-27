from datetime import datetime
from enum import Enum
from typing import Any
import ipaddress
import re
from urllib.parse import parse_qsl, urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ResourceType(str, Enum):
    WEBSITE = "Website"
    GOOGLE_DOCS = "Google Docs"
    GOOGLE_SHEETS = "Google Sheets"
    GOOGLE_DRIVE = "Google Drive"
    CANVA = "Canva"
    WORD = "Word"
    GITHUB = "GitHub"
    OTHER = "Other"


SENSITIVE_URL_PARAMETERS = {
    "access_token", "refresh_token", "id_token", "token", "api_key", "apikey",
    "password", "passwd", "client_secret", "authorization",
}


def validate_http_url(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("Resource URL must be a string")

    candidate = value.strip()
    if not candidate:
        raise ValueError("Resource URL cannot be empty")
    if len(candidate) > 2048:
        raise ValueError("Resource URL cannot exceed 2048 characters")
    if any(character.isspace() for character in candidate):
        raise ValueError("Resource URL cannot contain whitespace")
    if not re.match(r"^https?://", candidate, re.IGNORECASE) or re.search(r"[\\\x00-\x1f\x7f]", candidate):
        raise ValueError("Resource URL must be a complete HTTP or HTTPS URL")

    try:
        parsed = urlsplit(candidate)
        hostname = parsed.hostname
        _ = parsed.port
    except ValueError as exc:
        raise ValueError("Resource URL has an invalid hostname or port") from exc

    if parsed.scheme.lower() not in {"http", "https"}:
        raise ValueError("Resource URL must use http or https")
    if not hostname or not parsed.netloc:
        raise ValueError("Resource URL must include a valid hostname")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("Resource URL must not contain embedded credentials")
    if any(
        key.casefold() in SENSITIVE_URL_PARAMETERS
        for part in (parsed.query, parsed.fragment)
        for key, _ in parse_qsl(part, keep_blank_values=True)
    ):
        raise ValueError("Resource URL must not contain passwords or access tokens")
    if hostname.startswith(".") or hostname.endswith(".") or ".." in hostname:
        raise ValueError("Resource URL must include a valid hostname")

    try:
        ipaddress.ip_address(hostname)
    except ValueError:
        try:
            ascii_hostname = hostname.encode("idna").decode("ascii")
        except UnicodeError as exc:
            raise ValueError("Resource URL must include a valid hostname") from exc
        if len(ascii_hostname) > 253 or any(
            not re.fullmatch(r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?", label)
            for label in ascii_hostname.split(".")
        ):
            raise ValueError("Resource URL must include a valid hostname")

    return candidate


def normalize_optional_text(value: Any, *, max_length: int, field_name: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string")
    normalized = value.strip()
    if not normalized:
        return None
    if len(normalized) > max_length:
        raise ValueError(f"{field_name} cannot exceed {max_length} characters")
    return normalized


def normalize_keywords(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("Keywords must be a list")
    if len(value) > 20:
        raise ValueError("A resource can have at most 20 keywords")

    result: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            raise ValueError("Each keyword must be a string")
        keyword = item.strip()
        if not keyword:
            continue
        if len(keyword) > 50:
            raise ValueError("Each keyword cannot exceed 50 characters")
        identity = keyword.casefold()
        if identity not in seen:
            seen.add(identity)
            result.append(keyword)

    return result


def normalize_required_text(value: Any, *, max_length: int, field_name: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field_name} cannot be null")
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} cannot be empty")
    if len(normalized) > max_length:
        raise ValueError(f"{field_name} cannot exceed {max_length} characters")
    return normalized


class ProjectResourceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_id: str = Field(min_length=1, max_length=36)
    title: str
    url: str
    resource_type: ResourceType
    description: str | None = None
    keywords: list[str] = Field(default_factory=list)

    @field_validator("resource_type", mode="before")
    @classmethod
    def trim_resource_type(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("project_id", mode="before")
    @classmethod
    def validate_project_id(cls, value: Any) -> str:
        return normalize_required_text(value, max_length=36, field_name="Project ID")

    @field_validator("title", mode="before")
    @classmethod
    def validate_title(cls, value: Any) -> str:
        return normalize_required_text(value, max_length=255, field_name="Resource name")

    @field_validator("url", mode="before")
    @classmethod
    def validate_url(cls, value: Any) -> str:
        return validate_http_url(value)

    @field_validator("description", mode="before")
    @classmethod
    def validate_description(cls, value: Any) -> str | None:
        return normalize_optional_text(value, max_length=2000, field_name="Description")

    @field_validator("keywords", mode="before")
    @classmethod
    def validate_keywords(cls, value: Any) -> list[str]:
        return normalize_keywords(value)


class ProjectResourceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_id: str | None = None
    title: str | None = None
    url: str | None = None
    resource_type: ResourceType | None = None
    description: str | None = None
    keywords: list[str] | None = None

    @field_validator("project_id", mode="before")
    @classmethod
    def validate_project_id(cls, value: Any) -> str:
        return normalize_required_text(value, max_length=36, field_name="Project ID")

    @field_validator("title", mode="before")
    @classmethod
    def validate_title(cls, value: Any) -> str:
        return normalize_required_text(value, max_length=255, field_name="Resource name")

    @field_validator("url", mode="before")
    @classmethod
    def validate_url(cls, value: Any) -> str:
        return validate_http_url(value)

    @field_validator("resource_type", mode="before")
    @classmethod
    def validate_resource_type_not_null(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("Resource type cannot be null")
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def validate_description(cls, value: Any) -> str | None:
        return normalize_optional_text(value, max_length=2000, field_name="Description")

    @field_validator("keywords", mode="before")
    @classmethod
    def validate_keywords(cls, value: Any) -> list[str]:
        return normalize_keywords(value)


class ProjectResourceResponse(BaseModel):
    id: str
    project_id: str
    project_name: str
    title: str
    url: str
    resource_type: ResourceType
    description: str | None
    keywords: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectResourceListResponse(BaseModel):
    items: list[ProjectResourceResponse]
    total: int
    page: int
    page_size: int
    pages: int
