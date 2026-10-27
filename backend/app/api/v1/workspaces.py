from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.workspace import WorkspaceCreate, WorkspaceResponse


router = APIRouter(prefix="/workspaces", tags=["workspaces"])

WORKSPACE_SCHEMA_ERROR = (
    "Workspace schema is not ready. A separately approved database migration is required."
)


def workspace_schema_ready(db: Session) -> bool:
    if "workspace_schema_ready" not in db.info:
        db.info["workspace_schema_ready"] = db.execute(
            text(
                """
                SELECT to_regclass('public.users') IS NOT NULL
                   AND to_regclass('public.workspaces') IS NOT NULL
                   AND EXISTS (
                     SELECT 1 FROM information_schema.columns
                     WHERE table_schema='public'
                       AND table_name='projects'
                       AND column_name='workspace_id'
                   )
                """
            )
        ).scalar()
    return bool(db.info["workspace_schema_ready"])


def require_workspace_schema(db: Session) -> None:
    if not workspace_schema_ready(db):
        raise HTTPException(status_code=503, detail=WORKSPACE_SCHEMA_ERROR)


def require_active_user(db: Session, user_id: str, *, lock: bool = False) -> User:
    query = db.query(User).filter(User.id == user_id, User.is_active.is_(True))
    if lock:
        query = query.with_for_update()
    user = query.first()
    if not user:
        raise HTTPException(status_code=404, detail="Active user not found")
    return user


def require_workspace(db: Session, workspace_id: str) -> Workspace:
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.get("", response_model=list[WorkspaceResponse])
def list_workspaces(
    owner_user_id: str = Query(min_length=1, max_length=36),
    db: Session = Depends(get_db),
):
    require_workspace_schema(db)
    owner_user_id = owner_user_id.strip()
    require_active_user(db, owner_user_id)
    return (
        db.query(Workspace)
        .filter(
            Workspace.owner_user_id == owner_user_id,
            Workspace.workspace_type == "personal",
        )
        .order_by(Workspace.created_at, Workspace.id)
        .all()
    )


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(payload: WorkspaceCreate, db: Session = Depends(get_db)):
    require_workspace_schema(db)
    require_active_user(db, payload.owner_user_id, lock=True)
    if (
        db.query(Workspace.id)
        .filter(
            Workspace.owner_user_id == payload.owner_user_id,
            Workspace.workspace_type == "personal",
        )
        .first()
    ):
        raise HTTPException(status_code=409, detail="User already has a personal Workspace")

    workspace = Workspace(
        owner_user_id=payload.owner_user_id,
        name=payload.name,
        description=payload.description,
        workspace_type="personal",
    )
    db.add(workspace)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="User already has a personal Workspace"
        ) from error
    db.refresh(workspace)
    return workspace
