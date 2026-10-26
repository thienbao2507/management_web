import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class Subtask(Base):
    __tablename__ = "subtasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    is_completed = Column(Boolean, default=False)
    position = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    task = relationship("Task", back_populates="subtasks")
