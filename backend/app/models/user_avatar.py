from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func

from app.core.database import Base


class UserAvatar(Base):
    __tablename__ = "user_avatars"

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    image = Column(Text, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=func.now(),
    )
