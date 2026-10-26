from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict

class SprintBase(BaseModel):
    name: str
    goal: Optional[str] = None
    status: str = "active"
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class SprintCreate(SprintBase):
    project_id: str

class SprintResponse(SprintBase):
    id: str
    project_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
