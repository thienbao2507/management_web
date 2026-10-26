from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.task import Task
from app.models.subtask import Subtask
from app.models.project import Project
from app.schemas.task import TaskCreate, TaskUpdate, TaskReorder, TaskResponse
from app.schemas.subtask import SubtaskCreate, SubtaskUpdate, SubtaskResponse

router = APIRouter(prefix="/tasks", tags=["tasks"])

def generate_task_key(project: Project, db: Session) -> str:
    # Find highest task number for this project
    count = db.query(func.count(Task.id)).filter(Task.project_id == project.id).scalar() or 0
    next_num = count + 1
    candidate = f"{project.key}-{next_num}"
    
    # Ensure uniqueness in case of deleted tasks
    while db.query(Task).filter(Task.task_key == candidate).first():
        next_num += 1
        candidate = f"{project.key}-{next_num}"
    return candidate

@router.get("", response_model=List[TaskResponse])
def get_tasks(
    project_id: str = Query(...),
    sprint_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Task).filter(Task.project_id == project_id)

    if sprint_id:
        query = query.filter(Task.sprint_id == sprint_id)
    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Task.title.ilike(search_filter)) | 
            (Task.task_key.ilike(search_filter)) |
            (Task.category.ilike(search_filter)) |
            (Task.description.ilike(search_filter))
        )

    tasks = query.order_by(Task.status, Task.position.asc(), Task.created_at.desc()).all()
    return tasks

@router.post("", response_model=TaskResponse, status_code=201)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Task title cannot be empty")

    task_key = generate_task_key(project, db)

    # Determine highest position in the given column
    max_pos = db.query(func.max(Task.position)).filter(
        Task.project_id == payload.project_id,
        Task.status == (payload.status or "todo")
    ).scalar()
    new_position = (max_pos + 1) if max_pos is not None else 0

    task = Task(
        project_id=payload.project_id,
        sprint_id=payload.sprint_id,
        task_key=task_key,
        title=payload.title.strip(),
        description=payload.description,
        category=payload.category or "Feature",
        status=payload.status or "todo",
        priority=payload.priority or "medium",
        position=new_position,
        assignee_name=payload.assignee_name,
        assignee_avatar=payload.assignee_avatar,
        assignee_initials=payload.assignee_initials,
        due_date=payload.due_date,
        start_date=payload.start_date,
        weight=payload.weight or 1,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # Add initial subtasks if provided
    if payload.subtask_titles:
        for idx, title in enumerate(payload.subtask_titles):
            if title.strip():
                subtask = Subtask(
                    task_id=task.id,
                    title=title.strip(),
                    position=idx,
                    is_completed=False
                )
                db.add(subtask)
        db.commit()
        db.refresh(task)

    return task

@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: str,
    payload: TaskUpdate,
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task

@router.delete("/{task_id}", status_code=200)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = task.status
    old_pos = task.position
    project_id = task.project_id

    db.delete(task)
    
    # Adjust positions of remaining tasks in that column
    db.query(Task).filter(
        Task.project_id == project_id,
        Task.status == old_status,
        Task.position > old_pos
    ).update({Task.position: Task.position - 1})

    db.commit()
    return {"message": "Task deleted successfully", "id": task_id}

@router.patch("/{task_id}/reorder", response_model=TaskResponse)
def reorder_task(
    task_id: str,
    payload: TaskReorder,
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = task.status
    old_position = task.position
    new_status = payload.status
    new_position = payload.position
    project_id = task.project_id

    if old_status == new_status:
        # Reordering within same column
        if old_position < new_position:
            db.query(Task).filter(
                Task.project_id == project_id,
                Task.status == old_status,
                Task.position > old_position,
                Task.position <= new_position
            ).update({Task.position: Task.position - 1})
        elif old_position > new_position:
            db.query(Task).filter(
                Task.project_id == project_id,
                Task.status == old_status,
                Task.position >= new_position,
                Task.position < old_position
            ).update({Task.position: Task.position + 1})
    else:
        # Moving to different column
        # 1. Close the gap in old column
        db.query(Task).filter(
            Task.project_id == project_id,
            Task.status == old_status,
            Task.position > old_position
        ).update({Task.position: Task.position - 1})

        # 2. Make room in new column
        db.query(Task).filter(
            Task.project_id == project_id,
            Task.status == new_status,
            Task.position >= new_position
        ).update({Task.position: Task.position + 1})

    task.status = new_status
    task.position = new_position
    db.commit()
    db.refresh(task)
    return task

# Subtasks CRUD
@router.post("/{task_id}/subtasks", response_model=SubtaskResponse, status_code=201)
def add_subtask(
    task_id: str,
    payload: SubtaskCreate,
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    max_pos = db.query(func.max(Subtask.position)).filter(Subtask.task_id == task_id).scalar()
    new_position = (max_pos + 1) if max_pos is not None else 0

    subtask = Subtask(
        task_id=task_id,
        title=payload.title.strip(),
        is_completed=payload.is_completed,
        position=new_position
    )
    db.add(subtask)
    db.commit()
    db.refresh(subtask)
    return subtask

@router.patch("/{task_id}/subtasks/{subtask_id}", response_model=SubtaskResponse)
def update_subtask(
    task_id: str,
    subtask_id: str,
    payload: SubtaskUpdate,
    db: Session = Depends(get_db)
):
    subtask = db.query(Subtask).filter(Subtask.id == subtask_id, Subtask.task_id == task_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(subtask, field, value)

    db.commit()
    db.refresh(subtask)
    return subtask

@router.delete("/{task_id}/subtasks/{subtask_id}", status_code=200)
def delete_subtask(
    task_id: str,
    subtask_id: str,
    db: Session = Depends(get_db)
):
    subtask = db.query(Subtask).filter(Subtask.id == subtask_id, Subtask.task_id == task_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")

    db.delete(subtask)
    db.commit()
    return {"message": "Subtask deleted successfully", "id": subtask_id}
