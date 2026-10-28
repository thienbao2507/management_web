from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session, undefer

from app.models.project import Project
from app.models.project_membership import ProjectMembership
from app.models.workspace import Workspace


@dataclass(frozen=True)
class ProjectAccess:
    project: Project
    is_owner: bool


def accessible_project_filter(user_id: str):
    owner = exists(
        select(Workspace.id).where(
            Workspace.id == Project.workspace_id,
            Workspace.owner_user_id == user_id,
        )
    )
    member = exists(
        select(ProjectMembership.project_id).where(
            ProjectMembership.project_id == Project.id,
            ProjectMembership.user_id == user_id,
        )
    )
    return Project.workspace_id.is_not(None), or_(owner, member)


def accessible_project_query(db: Session, user_id: str, *, include_archived: bool = False):
    query = db.query(Project).options(undefer(Project.workspace_id)).filter(*accessible_project_filter(user_id))
    if not include_archived:
        query = query.filter(Project.is_archived.is_(False))
    return query


def require_workspace_owner(db: Session, workspace_id: str, user_id: str) -> Workspace:
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_user_id == user_id,
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def require_project_access(
    db: Session,
    project_id: str,
    user_id: str,
    *,
    owner_required: bool = False,
    include_archived: bool = False,
) -> ProjectAccess:
    project = accessible_project_query(db, user_id, include_archived=include_archived).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    workspace = db.query(Workspace).filter(Workspace.id == project.workspace_id).first()
    is_owner = bool(workspace and workspace.owner_user_id == user_id)
    if owner_required and not is_owner:
        raise HTTPException(status_code=403, detail="Workspace Owner permission is required")
    return ProjectAccess(project=project, is_owner=is_owner)
