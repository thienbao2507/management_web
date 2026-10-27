import hashlib
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, String, func
from app.core.database import Base

AVATAR_KEYS = ("owl", "fish", "cat", "panda", "hedgehog", "robot")


def avatar_key_for_id(user_id: str) -> str:
    return AVATAR_KEYS[int(hashlib.sha256(user_id.encode()).hexdigest(), 16) % len(AVATAR_KEYS)]


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint(
        "default_avatar_key IN ('owl','fish','cat','panda','hedgehog','robot')",
        name="ck_users_default_avatar_key",
    ),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    display_name = Column(String(255), nullable=False)
    email = Column(String(254), nullable=True)
    job_title = Column(String(150), nullable=True)
    default_avatar_key = Column(String(20), nullable=False)
    custom_avatar_url = Column(String(2048), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), server_default=func.now())
