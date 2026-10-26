from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class SubtaskBase(BaseModel):
    title: str
    is_completed: bool = False
    position: int = 0

class SubtaskCreate(SubtaskBase):
    pass

class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    is_completed: Optional[bool] = None
    position: Optional[int] = None

class SubtaskResponse(SubtaskBase):
    id: str
    task_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
