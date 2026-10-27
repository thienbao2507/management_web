from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.models import Project, Sprint, Task, User
from app.models.project_membership import ProjectMembership
from app.schemas.user import UserResponse
from app.schemas.sprint import SprintResponse

router = APIRouter(prefix="/projects", tags=["workspace"])


def require_project(db: Session, project_id: str):
    project = db.query(Project).filter(Project.id == project_id, Project.is_archived.is_(False)).first()
    if not project:
        raise HTTPException(404, "Active project not found")
    return project


def identity_schema_ready(db: Session) -> bool:
    if "identity_schema_ready" not in db.info:
        db.info["identity_schema_ready"] = db.execute(text("""
            SELECT to_regclass('public.users') IS NOT NULL
               AND to_regclass('public.project_memberships') IS NOT NULL
               AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='tasks' AND column_name='assignee_id')
        """)).scalar()
    return bool(db.info["identity_schema_ready"])


def require_identity_schema(db: Session):
    if not identity_schema_ready(db):
        raise HTTPException(503, "User integration schema is not ready. A separately approved database migration is required.")


class MemberCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str = Field(min_length=1, max_length=36)


class MemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    project_id: str
    user_id: str
    created_at: datetime
    user: UserResponse


@router.get("/{project_id}/members", response_model=list[MemberResponse])
def get_members(project_id: str, db: Session = Depends(get_db)):
    require_project(db, project_id)
    require_identity_schema(db)
    return db.query(ProjectMembership).options(joinedload(ProjectMembership.user)).filter(ProjectMembership.project_id == project_id).order_by(ProjectMembership.created_at, ProjectMembership.user_id).all()


@router.post("/{project_id}/members", response_model=MemberResponse, status_code=201)
def add_member(project_id: str, payload: MemberCreate, db: Session = Depends(get_db)):
    require_project(db, project_id)
    require_identity_schema(db)
    user = db.query(User).filter(User.id == payload.user_id).with_for_update().first()
    if not user or not user.is_active:
        raise HTTPException(404, "Active user not found")
    if db.get(ProjectMembership, (project_id, user.id)):
        raise HTTPException(409, "User is already a project member")
    member = ProjectMembership(project_id=project_id, user_id=user.id)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{project_id}/members/{user_id}")
def remove_member(project_id: str, user_id: str, db: Session = Depends(get_db)):
    require_project(db, project_id)
    require_identity_schema(db)
    member = db.query(ProjectMembership).filter_by(project_id=project_id, user_id=user_id).with_for_update().first()
    if not member:
        raise HTTPException(404, "Membership not found")
    if db.query(Task.id).filter(Task.project_id == project_id, Task.assignee_id == user_id).first():
        raise HTTPException(409, "Member still has assigned tasks. Reassign them explicitly before removing membership; no tasks were changed.")
    db.delete(member)
    db.commit()
    return {"message": "Membership removed; user and tasks were not deleted"}


@router.get("/{project_id}/sprints", response_model=list[SprintResponse])
def list_sprints(project_id: str, db: Session = Depends(get_db)):
    require_project(db, project_id)
    return db.query(Sprint).filter(Sprint.project_id == project_id).order_by(Sprint.created_at, Sprint.id).all()
