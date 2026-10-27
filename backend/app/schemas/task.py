from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.subtask import SubtaskResponse
from app.schemas.user import UserResponse

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "General"
    status: str = "todo"
    priority: str = "medium"
    position: int = 0
    assignee_name: Optional[str] = None
    assignee_avatar: Optional[str] = None
    assignee_initials: Optional[str] = None
    assignee_email: Optional[str] = None
    due_date: Optional[date] = None
    start_date: Optional[date] = None
    weight: int = 1
    is_blocked: bool = False
    blocker_reason: Optional[str] = None
    thumbnail: Optional[str] = None

class TaskCreate(BaseModel):
    project_id: str
    sprint_id: Optional[str] = Field(None, min_length=1, max_length=36)
    assignee_id: Optional[str] = Field(None, min_length=1, max_length=36)
    title: str
    description: Optional[str] = None
    category: Optional[str] = "Feature"
    status: Optional[str] = "todo"
    priority: Optional[str] = "medium"
    due_date: Optional[date] = None
    start_date: Optional[date] = None
    weight: Optional[int] = 1
    assignee_name: Optional[str] = None
    assignee_avatar: Optional[str] = None
    assignee_initials: Optional[str] = None
    subtask_titles: Optional[List[str]] = []

class TaskUpdate(BaseModel):
    assignee_id: Optional[str] = Field(None, min_length=1, max_length=36)
    sprint_id: Optional[str] = Field(None, min_length=1, max_length=36)
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    position: Optional[int] = None
    due_date: Optional[date] = None
    start_date: Optional[date] = None
    weight: Optional[int] = None
    is_blocked: Optional[bool] = None
    blocker_reason: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_avatar: Optional[str] = None
    assignee_initials: Optional[str] = None
    thumbnail: Optional[str] = None

class TaskReorder(BaseModel):
    status: str
    position: int
    sprint_id: Optional[str] = None
    unsprinted: bool = False

class TaskResponse(TaskBase):
    assignee_id: Optional[str] = None
    assignee: Optional[UserResponse] = None
    id: str
    project_id: str
    sprint_id: Optional[str] = None
    task_key: str
    created_at: datetime
    updated_at: datetime
    subtasks: List[SubtaskResponse] = []

    model_config = ConfigDict(from_attributes=True)
