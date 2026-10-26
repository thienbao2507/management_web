import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Date, Boolean, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    sprint_id = Column(String(36), ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True, index=True)
    task_key = Column(String(20), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, default="General")
    status = Column(String(50), nullable=False, default="todo")  # backlog, todo, in_progress, done
    priority = Column(String(20), nullable=False, default="medium")  # low, medium, high, urgent
    position = Column(Integer, nullable=False, default=0)
    
    # Assignee fields
    assignee_name = Column(String(255), nullable=True)
    assignee_avatar = Column(String(500), nullable=True)
    assignee_initials = Column(String(10), nullable=True)
    assignee_email = Column(String(255), nullable=True)
    
    due_date = Column(Date, nullable=True)
    start_date = Column(Date, nullable=True)
    weight = Column(Integer, default=1)
    
    # Blocker indicators
    is_blocked = Column(Boolean, default=False)
    blocker_reason = Column(Text, nullable=True)
    
    thumbnail = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="tasks")
    sprint = relationship("Sprint", back_populates="tasks")
    subtasks = relationship("Subtask", back_populates="task", cascade="all, delete-orphan", order_by="Subtask.position")
