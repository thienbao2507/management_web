import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Date, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class Sprint(Base):
    __tablename__ = "sprints"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    goal = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="active")  # planned, active, completed
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="sprints")
    tasks = relationship("Task", back_populates="sprint")
