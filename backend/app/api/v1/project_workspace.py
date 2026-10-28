from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.auth import get_request_auth, require_authenticated_request
from app.core.authorization import require_project_access
from app.models import Sprint, Task
from app.models.auth import AuthAccount
from app.models.project_membership import ProjectMembership
from app.schemas.user import UserResponse
from app.schemas.sprint import SprintResponse
from app.schemas.auth import normalize_login_email

router = APIRouter(prefix="/projects", tags=["workspace"], dependencies=[Depends(require_authenticated_request)])

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
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, value):
        return normalize_login_email(value)


class MemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    project_id: str
    user_id: str
    created_at: datetime
    user: UserResponse


@router.get("/{project_id}/members", response_model=list[MemberResponse])
def get_members(project_id: str, request: Request, db: Session = Depends(get_db)):
    require_project_access(db, project_id, get_request_auth(request).user.id)
    require_identity_schema(db)
    return db.query(ProjectMembership).options(joinedload(ProjectMembership.user)).filter(ProjectMembership.project_id == project_id).order_by(ProjectMembership.created_at, ProjectMembership.user_id).all()


@router.post("/{project_id}/members", response_model=MemberResponse, status_code=201)
def add_member(project_id: str, payload: MemberCreate, request: Request, db: Session = Depends(get_db)):
    require_project_access(db, project_id, get_request_auth(request).user.id, owner_required=True)
    require_identity_schema(db)
    account = db.query(AuthAccount).filter(
        AuthAccount.email == payload.email,
        AuthAccount.email_verified_at.is_not(None),
    ).with_for_update().first()
    user = account.user if account else None
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
def remove_member(project_id: str, user_id: str, request: Request, db: Session = Depends(get_db)):
    require_project_access(db, project_id, get_request_auth(request).user.id, owner_required=True)
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
def list_sprints(project_id: str, request: Request, db: Session = Depends(get_db)):
    require_project_access(db, project_id, get_request_auth(request).user.id)
    return db.query(Sprint).filter(Sprint.project_id == project_id).order_by(Sprint.created_at, Sprint.id).all()
