from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict

class ProjectBase(BaseModel):
    name: str
    key: str
    description: Optional[str] = None
    status: str = "active"
    priority: str = "medium"
    start_date: Optional[date] = None
    due_date: Optional[date] = None

class ProjectCreate(BaseModel):
    name: str
    key: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "active"
    priority: Optional[str] = "medium"
    start_date: Optional[date] = None
    due_date: Optional[date] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    is_archived: Optional[bool] = None

class ProjectResponse(ProjectBase):
    id: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    tasks_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)
