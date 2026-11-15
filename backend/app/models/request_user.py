import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, JSON, String, Text, func

from app.core.database import Base


class RequestUser(Base):
    __tablename__ = "request_users"
    __table_args__ = (
        CheckConstraint(
            "category IN ('bug', 'feature', 'other')",
            name="ck_request_users_category",
        ),
        Index("ix_request_users_user_id", "user_id"),
        Index("ix_request_users_created_at", "created_at"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    category = Column(String(16), nullable=False)
    content = Column(Text, nullable=False)
    images = Column(JSON, nullable=False, default=list, server_default="'[]'")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
