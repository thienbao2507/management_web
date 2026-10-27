import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Workspace(Base):
    __tablename__ = "workspaces"
    __table_args__ = (
        CheckConstraint(
            "workspace_type IN ('personal')",
            name="ck_workspaces_workspace_type",
        ),
        Index(
            "uq_workspaces_personal_owner",
            "owner_user_id",
            unique=True,
            postgresql_where=text("workspace_type = 'personal'"),
        ),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    workspace_type = Column(
        String(20), nullable=False, default="personal", server_default="personal"
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    owner = relationship("User")
    projects = relationship("Project", back_populates="workspace", viewonly=True)
