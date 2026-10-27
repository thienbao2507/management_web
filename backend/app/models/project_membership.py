from sqlalchemy import Column, String, ForeignKey, DateTime, Index, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class ProjectMembership(Base):
    __tablename__ = "project_memberships"
    __table_args__ = (Index("ix_project_memberships_user_id", "user_id"),)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    user = relationship("User")
