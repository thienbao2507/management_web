import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.project import Project
from app.models.task import Task
from app.models.sprint import Sprint
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])

def generate_project_key(name: str, db: Session) -> str:
    # Generate 3-4 letters uppercase key from words in name
    words = re.findall(r'[a-zA-Z0-9]+', name)
    if len(words) >= 3:
        raw_key = "".join(w[0] for w in words[:4]).upper()
    elif len(words) == 2:
        raw_key = (words[0][:2] + words[1][:2]).upper()
    elif len(words) == 1:
        raw_key = words[0][:3].upper()
    else:
        raw_key = "PRJ"

    if len(raw_key) < 2:
        raw_key = "PRJ"

    # Ensure uniqueness
    candidate = raw_key
    suffix = 1
    while db.query(Project).filter(Project.key == candidate).first():
        candidate = f"{raw_key}{suffix}"
        suffix += 1
    return candidate

@router.get("", response_model=List[ProjectResponse])
def get_projects(
    include_archived: bool = Query(False),
    db: Session = Depends(get_db)
):
    query = db.query(Project)
    if not include_archived:
        query = query.filter(Project.is_archived == False)
    projects = query.order_by(Project.created_at.desc()).all()

    # Calculate tasks count per project
    result = []
    for p in projects:
        count = db.query(func.count(Task.id)).filter(Task.project_id == p.id).scalar() or 0
        resp = ProjectResponse.model_validate(p)
        resp.tasks_count = count
        result.append(resp)
    return result

@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db)
):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Project name cannot be empty")

    key = payload.key.upper().strip() if payload.key else generate_project_key(payload.name, db)
    
    # Check if key already exists
    existing = db.query(Project).filter(Project.key == key).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Project key '{key}' already exists")

    project = Project(
        name=payload.name.strip(),
        key=key,
        description=payload.description,
        status=payload.status or "active",
        priority=payload.priority or "medium",
        start_date=payload.start_date,
        due_date=payload.due_date,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Automatically create a default active Sprint for this project
    sprint = Sprint(
        project_id=project.id,
        name=f"Sprint 1 — {project.name}",
        goal=f"Initial sprint for {project.name}",
        status="active"
    )
    db.add(sprint)
    db.commit()

    resp = ProjectResponse.model_validate(project)
    resp.tasks_count = 0
    return resp

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    count = db.query(func.count(Task.id)).filter(Task.project_id == project.id).scalar() or 0
    resp = ProjectResponse.model_validate(project)
    resp.tasks_count = count
    return resp

@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    
    count = db.query(func.count(Task.id)).filter(Task.project_id == project.id).scalar() or 0
    resp = ProjectResponse.model_validate(project)
    resp.tasks_count = count
    return resp

@router.delete("/{project_id}", status_code=200)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Soft delete / archive
    project.is_archived = True
    db.commit()
    return {"message": "Project archived successfully", "id": project_id}
