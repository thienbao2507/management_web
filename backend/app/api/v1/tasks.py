from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, undefer
from sqlalchemy import func, insert
from app.api.v1.project_workspace import require_project, identity_schema_ready, require_identity_schema
from app.models.user import User
from app.models.sprint import Sprint
from app.models.project_membership import ProjectMembership

from app.core.database import get_db
from app.models.task import Task
from app.models.subtask import Subtask
from app.models.project import Project
from app.schemas.task import TaskCreate, TaskUpdate, TaskReorder, TaskResponse
from app.schemas.subtask import SubtaskCreate, SubtaskUpdate, SubtaskResponse

router = APIRouter(prefix="/tasks", tags=["tasks"])


def task_query(db: Session):
    query = db.query(Task)
    return query.options(undefer(Task.assignee_id)) if identity_schema_ready(db) else query


def task_result(task: Task, db: Session):
    fields = set(TaskResponse.model_fields) - {"assignee_id", "assignee"}
    result = {field: getattr(task, field) for field in fields}
    assignee_id = task.__dict__.get("assignee_id") if identity_schema_ready(db) else None
    result["assignee_id"] = assignee_id
    result["assignee"] = db.get(User, assignee_id) if assignee_id else None
    return result


def validate_sprint(db: Session, project_id: str, sprint_id: str | None):
    if sprint_id and not db.query(Sprint.id).filter(Sprint.id == sprint_id, Sprint.project_id == project_id).first():
        raise HTTPException(422, "Sprint must belong to the task's project")


def validate_assignee(db: Session, project_id: str, user_id: str | None):
    if not user_id:
        return
    require_identity_schema(db)
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if not user or not user.is_active:
        raise HTTPException(422, "Assignee must be an active user")
    member = db.query(ProjectMembership).filter_by(project_id=project_id, user_id=user_id).with_for_update().first()
    if not member:
        raise HTTPException(422, "Assignee must be a member of this project")


def find_task(db: Session, task_id: str):
    task = task_query(db).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    require_project(db, task.project_id)
    return task

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
    unsprinted: bool = Query(False),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_project(db, project_id)
    if sprint_id and unsprinted:
        raise HTTPException(422, "Choose either sprint_id or unsprinted")
    validate_sprint(db, project_id, sprint_id)
    query = task_query(db).filter(Task.project_id == project_id)
    if unsprinted:
        query = query.filter(Task.sprint_id.is_(None))

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
    return [task_result(task, db) for task in tasks]

@router.post("", response_model=TaskResponse, status_code=201)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db)
):
    project = require_project(db, payload.project_id)
    validate_sprint(db, project.id, payload.sprint_id)
    validate_assignee(db, project.id, payload.assignee_id)
    if payload.assignee_id and any(value is not None for value in (payload.assignee_name, payload.assignee_avatar, payload.assignee_initials)):
        raise HTTPException(422, "Send assignee_id without client identity metadata")

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
    if identity_schema_ready(db):
        task.assignee_id = payload.assignee_id
        db.add(task)
        db.flush()
    else:
        # Keep ordinary task creation working without adding any schema/data
        # migration. Core insert omits the not-yet-existing nullable column.
        values = {key: value for key, value in task.__dict__.items() if not key.startswith("_")}
        result = db.execute(insert(Task.__table__).values(**values))
        task = task_query(db).filter(Task.id == result.inserted_primary_key[0]).one()

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
    task = find_task(db, task.id)
    return task_result(task, db)

@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: str, db: Session = Depends(get_db)):
    return task_result(find_task(db, task_id), db)

@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: str,
    payload: TaskUpdate,
    db: Session = Depends(get_db)
):
    task = find_task(db, task_id)

    update_data = payload.model_dump(exclude_unset=True)
    if "sprint_id" in update_data:
        validate_sprint(db, task.project_id, update_data["sprint_id"])
    if "assignee_id" in update_data:
        validate_assignee(db, task.project_id, update_data["assignee_id"])
        if not identity_schema_ready(db):
            update_data.pop("assignee_id")
        elif update_data["assignee_id"] is None:
            for key in ("assignee_name", "assignee_avatar", "assignee_initials", "assignee_email"):
                setattr(task, key, None)
    if task.__dict__.get("assignee_id") or update_data.get("assignee_id"):
        for key in ("assignee_name", "assignee_avatar", "assignee_initials"):
            if key in update_data:
                raise HTTPException(422, "Use assignee_id to change a linked identity; client metadata is not authoritative")
    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task_result(find_task(db, task_id), db)

@router.delete("/{task_id}", status_code=200)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = find_task(db, task_id)

    old_status = task.status
    old_pos = task.position
    project_id = task.project_id

    db.delete(task)
    
    # Adjust positions of remaining tasks in that column
    db.query(Task).filter(
        Task.project_id == project_id,
        Task.sprint_id == task.sprint_id,
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
    task = find_task(db, task_id)

    old_status = task.status
    old_position = task.position
    new_status = payload.status
    new_position = payload.position
    project_id = task.project_id

    scope = [Task.project_id == project_id]
    if payload.sprint_id:
        if task.sprint_id != payload.sprint_id:
            raise HTTPException(422, "Reorder sprint does not match the task")
        scope.append(Task.sprint_id == payload.sprint_id)
    if payload.unsprinted:
        if task.sprint_id is not None or payload.sprint_id:
            raise HTTPException(422, "Task is not unsprinted")
        scope.append(Task.sprint_id.is_(None))

    if old_status == new_status:
        # Reordering within same column
        if old_position < new_position:
            db.query(Task).filter(
                *scope,
                Task.status == old_status,
                Task.position > old_position,
                Task.position <= new_position
            ).update({Task.position: Task.position - 1})
        elif old_position > new_position:
            db.query(Task).filter(
                *scope,
                Task.status == old_status,
                Task.position >= new_position,
                Task.position < old_position
            ).update({Task.position: Task.position + 1})
    else:
        # Moving to different column
        # 1. Close the gap in old column
        db.query(Task).filter(
            *scope,
            Task.status == old_status,
            Task.position > old_position
        ).update({Task.position: Task.position - 1})

        # 2. Make room in new column
        db.query(Task).filter(
            *scope,
            Task.status == new_status,
            Task.position >= new_position
        ).update({Task.position: Task.position + 1})

    task.status = new_status
    task.position = new_position
    db.commit()
    db.refresh(task)
    return task_result(find_task(db, task_id), db)

# Subtasks CRUD
@router.post("/{task_id}/subtasks", response_model=SubtaskResponse, status_code=201)
def add_subtask(
    task_id: str,
    payload: SubtaskCreate,
    db: Session = Depends(get_db)
):
    task = find_task(db, task_id)

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
    find_task(db, task_id)
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
    find_task(db, task_id)
    subtask = db.query(Subtask).filter(Subtask.id == subtask_id, Subtask.task_id == task_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")

    db.delete(subtask)
    db.commit()
    return {"message": "Subtask deleted successfully", "id": subtask_id}
