import re
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, undefer

from app.api.v1.workspaces import (
    require_workspace,
    require_workspace_schema,
    workspace_schema_ready,
)
from app.core.database import get_db
from app.models.project import Project
from app.models.sprint import Sprint
from app.models.task import Task
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate


router = APIRouter(prefix="/projects", tags=["projects"])


def generate_project_key(name: str, db: Session) -> str:
    words = re.findall(r"[a-zA-Z0-9]+", name)
    if len(words) >= 3:
        raw_key = "".join(word[0] for word in words[:4]).upper()
    elif len(words) == 2:
        raw_key = (words[0][:2] + words[1][:2]).upper()
    elif len(words) == 1:
        raw_key = words[0][:3].upper()
    else:
        raw_key = "PRJ"

    if len(raw_key) < 2:
        raw_key = "PRJ"

    candidate = raw_key
    suffix = 1
    while db.query(Project).filter(Project.key == candidate).first():
        candidate = f"{raw_key}{suffix}"
        suffix += 1
    return candidate


def project_to_response(
    project: Project, tasks_count: int, *, include_workspace: bool
) -> ProjectResponse:
    return ProjectResponse(
        id=project.id,
        workspace_id=project.workspace_id if include_workspace else None,
        key=project.key,
        name=project.name,
        description=project.description,
        status=project.status,
        priority=project.priority,
        start_date=project.start_date,
        due_date=project.due_date,
        is_archived=bool(project.is_archived),
        created_at=project.created_at,
        updated_at=project.updated_at,
        tasks_count=tasks_count,
    )


def project_query(db: Session, *, include_workspace: bool):
    query = db.query(Project)
    if include_workspace:
        query = query.options(undefer(Project.workspace_id))
    return query


def get_project_response(
    db: Session, project_id: str, *, include_workspace: bool
) -> ProjectResponse:
    project = project_query(db, include_workspace=include_workspace).filter(
        Project.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    count = db.query(func.count(Task.id)).filter(Task.project_id == project.id).scalar() or 0
    return project_to_response(project, count, include_workspace=include_workspace)


@router.get("", response_model=List[ProjectResponse])
def get_projects(
    include_archived: bool = Query(False),
    workspace_id: Optional[str] = Query(default=None, min_length=1, max_length=36),
    unassigned: bool = Query(False),
    db: Session = Depends(get_db),
):
    if workspace_id and unassigned:
        raise HTTPException(
            status_code=422,
            detail="workspace_id and unassigned cannot be used together",
        )

    schema_ready = workspace_schema_ready(db)
    if workspace_id:
        require_workspace_schema(db)
        workspace_id = workspace_id.strip()
        require_workspace(db, workspace_id)

    query = project_query(db, include_workspace=schema_ready)
    if workspace_id:
        query = query.filter(Project.workspace_id == workspace_id)
    elif unassigned and schema_ready:
        query = query.filter(Project.workspace_id.is_(None))
    if not include_archived:
        query = query.filter(Project.is_archived.is_(False))
    projects = query.order_by(Project.created_at.desc()).all()

    result = []
    for project in projects:
        count = (
            db.query(func.count(Task.id))
            .filter(Task.project_id == project.id)
            .scalar()
            or 0
        )
        result.append(
            project_to_response(project, count, include_workspace=schema_ready)
        )
    return result


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Project name cannot be empty")

    schema_ready = workspace_schema_ready(db)
    if schema_ready and not payload.workspace_id:
        raise HTTPException(
            status_code=422,
            detail="workspace_id is required when the Workspace schema is available",
        )
    if payload.workspace_id:
        require_workspace_schema(db)
        require_workspace(db, payload.workspace_id)

    key = payload.key.upper().strip() if payload.key else generate_project_key(payload.name, db)
    if db.query(Project).filter(Project.key == key).first():
        raise HTTPException(status_code=400, detail=f"Project key '{key}' already exists")

    project_id = str(uuid.uuid4())
    project_values = {
        "id": project_id,
        "name": payload.name.strip(),
        "key": key,
        "description": payload.description,
        "status": payload.status or "active",
        "priority": payload.priority or "medium",
        "start_date": payload.start_date,
        "due_date": payload.due_date,
    }
    if schema_ready:
        project = Project(**project_values, workspace_id=payload.workspace_id)
        db.add(project)
    else:
        now = datetime.utcnow()
        db.execute(
            Project.__table__.insert().values(
                **project_values,
                is_archived=False,
                created_at=now,
                updated_at=now,
            )
        )

    db.add(
        Sprint(
            project_id=project_id,
            name=f"Sprint 1 — {payload.name.strip()}",
            goal=f"Initial sprint for {payload.name.strip()}",
            status="active",
        )
    )
    db.commit()

    return get_project_response(db, project_id, include_workspace=schema_ready)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)):
    return get_project_response(
        db, project_id, include_workspace=workspace_schema_ready(db)
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
):
    schema_ready = workspace_schema_ready(db)
    project = project_query(db, include_workspace=schema_ready).filter(
        Project.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    db.commit()
    return get_project_response(db, project_id, include_workspace=schema_ready)


@router.delete("/{project_id}", status_code=200)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.is_archived = True
    db.commit()
    return {"message": "Project archived successfully", "id": project_id}
