from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, func

from app.core.database import Base


class UserBackground(Base):
    __tablename__ = "user_backgrounds"
    __table_args__ = (
        CheckConstraint("dim BETWEEN 0 AND 80", name="ck_user_backgrounds_dim"),
    )

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    image = Column(Text, nullable=False)
    dim = Column(Integer, nullable=False, default=40, server_default="40")
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
