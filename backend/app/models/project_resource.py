import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship

from app.core.database import Base


class ProjectResource(Base):
    __tablename__ = "project_resources"
    __table_args__ = (
        CheckConstraint(
            "resource_type IN ('Website', 'Google Docs', 'Google Sheets', 'Google Drive', 'Canva', 'Word', 'GitHub', 'Other')",
            name="ck_project_resources_resource_type",
        ),
        Index("ix_project_resources_created_at", "created_at"),
        Index("ix_project_resources_project_created_at", "project_id", "created_at"),
        Index("ix_project_resources_type_created_at", "resource_type", "created_at"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    title = Column(String(255), nullable=False)
    url = Column(String(2048), nullable=False)
    resource_type = Column(String(30), nullable=False)
    description = Column(Text, nullable=True)
    keywords = Column(
        ARRAY(Text),
        nullable=False,
        default=list,
        server_default="{}",
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    project = relationship("Project", back_populates="resources")
