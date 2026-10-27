import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import deferred, relationship
from app.core.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = deferred(
        Column(
            String(36),
            ForeignKey("workspaces.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        )
    )
    key = Column(String(10), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="active")
    priority = Column(String(20), nullable=False, default="medium")
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    # Read-only navigation keeps legacy-schema Project deletes from trying to
    # lazy-load the deferred workspace_id column before the migration exists.
    # API writes use workspace_id directly after confirming schema readiness.
    workspace = relationship("Workspace", back_populates="projects", viewonly=True)
    sprints = relationship("Sprint", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    resources = relationship(
        "ProjectResource", back_populates="project", cascade="all, delete-orphan"
    )
