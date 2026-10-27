import math
import unicodedata
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session, joinedload

from app.api.v1.workspaces import (
    require_workspace,
    require_workspace_schema,
    workspace_schema_ready,
)
from app.core.config import settings
from app.core.database import get_db
from app.models.project import Project
from app.models.project_resource import ProjectResource
from app.schemas.project_resource import (
    ProjectResourceCreate,
    ProjectResourceListResponse,
    ProjectResourceResponse,
    ProjectResourceUpdate,
    ResourceType,
)

router = APIRouter(prefix="/resources", tags=["resources"])

_VIETNAMESE_GROUPS = {
    "a": "áàảãạăắằẳẵặâấầẩẫậ",
    "e": "éèẻẽẹêếềểễệ",
    "i": "íìỉĩị",
    "o": "óòỏõọôốồổỗộơớờởỡợ",
    "u": "úùủũụưứừửữự",
    "y": "ýỳỷỹỵ",
    "d": "đ",
}
_LOWER_SOURCE = "".join(_VIETNAMESE_GROUPS.values())
_LOWER_TARGET = "".join(
    base * len(characters) for base, characters in _VIETNAMESE_GROUPS.items()
)
VIETNAMESE_SOURCE = _LOWER_SOURCE + _LOWER_SOURCE.upper()
VIETNAMESE_TARGET = _LOWER_TARGET * 2


def normalize_vietnamese_search(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.strip().casefold())
    return "".join(
        "d" if character == "đ" else character
        for character in decomposed
        if not unicodedata.combining(character)
    )


def normalized_database_text(expression):
    return func.translate(
        func.lower(func.normalize(func.coalesce(cast(expression, String), ""))),
        VIETNAMESE_SOURCE,
        VIETNAMESE_TARGET,
    )


def escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def application_day_bounds(
    created_from: date | None, created_to: date | None
) -> tuple[datetime | None, datetime | None]:
    if created_from and created_to and created_from > created_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="created_from cannot be after created_to",
        )
    if created_to == date.max:
        raise HTTPException(status_code=422, detail="created_to must be before 9999-12-31")

    app_timezone = ZoneInfo(settings.APP_TIMEZONE)
    start = None
    end_exclusive = None
    if created_from:
        start = datetime.combine(created_from, time.min, app_timezone).astimezone(
            timezone.utc
        )
    if created_to:
        end_exclusive = datetime.combine(
            created_to + timedelta(days=1), time.min, app_timezone
        ).astimezone(timezone.utc)
    return start, end_exclusive


def active_project_query(db: Session):
    return db.query(Project).filter(Project.is_archived.is_(False))


def get_active_project(db: Session, project_id: str) -> Project:
    project = active_project_query(db).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Active project not found")
    return project


def resource_to_response(resource: ProjectResource) -> ProjectResourceResponse:
    return ProjectResourceResponse(
        id=resource.id,
        project_id=resource.project_id,
        project_name=resource.project.name,
        title=resource.title,
        url=resource.url,
        resource_type=resource.resource_type,
        description=resource.description,
        keywords=resource.keywords or [],
        created_at=resource.created_at.astimezone(timezone.utc),
        updated_at=resource.updated_at.astimezone(timezone.utc),
    )


def accessible_resource_query(db: Session):
    return (
        db.query(ProjectResource)
        .join(Project, Project.id == ProjectResource.project_id)
        .filter(Project.is_archived.is_(False))
    )


@router.get("", response_model=ProjectResourceListResponse)
def list_resources(
    q: str | None = Query(default=None, max_length=200),
    project_id: str | None = Query(default=None, min_length=1, max_length=36),
    workspace_id: str | None = Query(default=None, min_length=1, max_length=36),
    unassigned: bool = Query(default=False),
    resource_type: ResourceType | None = Query(default=None),
    created_from: date | None = Query(default=None),
    created_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1, le=100_000),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    if workspace_id and unassigned:
        raise HTTPException(
            status_code=422,
            detail="workspace_id and unassigned cannot be used together",
        )
    start, end_exclusive = application_day_bounds(created_from, created_to)
    filters = []

    if project_id:
        filters.append(ProjectResource.project_id == project_id.strip())
    schema_ready = workspace_schema_ready(db)
    if workspace_id:
        require_workspace_schema(db)
        workspace_id = workspace_id.strip()
        require_workspace(db, workspace_id)
        filters.append(Project.workspace_id == workspace_id)
    elif unassigned and schema_ready:
        filters.append(Project.workspace_id.is_(None))
    if resource_type:
        filters.append(ProjectResource.resource_type == resource_type.value)
    if start:
        filters.append(ProjectResource.created_at >= start)
    if end_exclusive:
        filters.append(ProjectResource.created_at < end_exclusive)

    normalized_query = normalize_vietnamese_search(q) if q and q.strip() else None
    if normalized_query:
        pattern = f"%{escape_like(normalized_query)}%"
        filters.append(
            or_(
                normalized_database_text(Project.name).like(pattern, escape="\\"),
                normalized_database_text(ProjectResource.title).like(
                    pattern, escape="\\"
                ),
                normalized_database_text(ProjectResource.description).like(
                    pattern, escape="\\"
                ),
                normalized_database_text(ProjectResource.resource_type).like(
                    pattern, escape="\\"
                ),
                normalized_database_text(
                    func.array_to_string(ProjectResource.keywords, " ")
                ).like(pattern, escape="\\"),
            )
        )

    base_query = accessible_resource_query(db).filter(*filters)
    total = base_query.with_entities(func.count(ProjectResource.id)).scalar() or 0
    resources = (
        base_query.options(joinedload(ProjectResource.project))
        .order_by(ProjectResource.created_at.desc(), ProjectResource.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return ProjectResourceListResponse(
        items=[resource_to_response(resource) for resource in resources],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


@router.get("/{resource_id}", response_model=ProjectResourceResponse)
def get_resource(resource_id: str, db: Session = Depends(get_db)):
    resource = (
        accessible_resource_query(db)
        .options(joinedload(ProjectResource.project))
        .filter(ProjectResource.id == resource_id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource_to_response(resource)


@router.post(
    "",
    response_model=ProjectResourceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_resource(payload: ProjectResourceCreate, db: Session = Depends(get_db)):
    project = get_active_project(db, payload.project_id)
    resource = ProjectResource(
        project_id=payload.project_id,
        title=payload.title,
        url=payload.url,
        resource_type=payload.resource_type.value,
        description=payload.description,
        keywords=payload.keywords,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    resource.project = project
    return resource_to_response(resource)


@router.patch("/{resource_id}", response_model=ProjectResourceResponse)
def update_resource(
    resource_id: str,
    payload: ProjectResourceUpdate,
    db: Session = Depends(get_db),
):
    resource = (
        accessible_resource_query(db)
        .options(joinedload(ProjectResource.project))
        .filter(ProjectResource.id == resource_id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "project_id" in update_data:
        resource.project = get_active_project(db, update_data["project_id"])
    if "resource_type" in update_data:
        update_data["resource_type"] = update_data["resource_type"].value

    if update_data:
        for field, value in update_data.items():
            setattr(resource, field, value)
        resource.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(resource)

    return resource_to_response(resource)


@router.delete("/{resource_id}")
def delete_resource(resource_id: str, db: Session = Depends(get_db)):
    resource = (
        accessible_resource_query(db)
        .filter(ProjectResource.id == resource_id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    db.delete(resource)
    db.commit()
    return {"message": "Resource deleted successfully", "id": resource_id}
