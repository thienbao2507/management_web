import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Date, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
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
    sprints = relationship("Sprint", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
