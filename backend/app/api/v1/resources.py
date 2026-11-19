import math
import unicodedata
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import String, and_, cast, func, not_, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session, aliased, contains_eager, joinedload

from app.api.v1.workspaces import (
    require_workspace_schema,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.auth import get_request_auth, require_authenticated_request
from app.core.authorization import accessible_project_filter, require_project_access, require_workspace_owner
from app.models.project import Project
from app.models.workspace import Workspace
from app.models.user import User
from app.models.project_resource import ProjectResource, ProjectResourcePin
from app.schemas.project_resource import (
    ProjectResourceCreate,
    ProjectResourceListResponse,
    ProjectResourceResponse,
    ProjectResourceUpdate,
    ResourceAuthor,
    ResourcePublicUpdate,
    ResourceType,
)

router = APIRouter(prefix="/resources", tags=["resources"], dependencies=[Depends(require_authenticated_request)])

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


def resource_access_map(
    db: Session, user_id: str, project_ids: set[str]
) -> dict[str, bool]:
    """Map accessible project id -> whether the user owns its workspace (one query)."""
    if not project_ids:
        return {}
    # Alias so the EXISTS subqueries in accessible_project_filter don't auto-correlate away.
    owner_workspace = aliased(Workspace)
    rows = (
        db.query(Project.id, owner_workspace.owner_user_id)
        .outerjoin(owner_workspace, owner_workspace.id == Project.workspace_id)
        .filter(Project.id.in_(project_ids), *accessible_project_filter(user_id))
        .all()
    )
    return {project_id: owner_id == user_id for project_id, owner_id in rows}


def project_owner_map(db: Session, project_ids: set[str]) -> dict[str, User]:
    """Map project id -> its workspace owner; used as author for legacy links without created_by."""
    if not project_ids:
        return {}
    rows = (
        db.query(Project.id, User)
        .join(Workspace, Workspace.id == Project.workspace_id)
        .join(User, User.id == Workspace.owner_user_id)
        .filter(Project.id.in_(project_ids))
        .all()
    )
    return {project_id: user for project_id, user in rows}


def resource_to_response(
    resource: ProjectResource,
    *,
    is_pinned: bool = False,
    user_id: str,
    access: dict[str, bool],
    owners: dict[str, User] | None = None,
) -> ProjectResourceResponse:
    can_manage = resource.project_id in access
    if resource.created_by_user_id is not None:
        can_toggle_public = resource.created_by_user_id == user_id
    else:
        can_toggle_public = access.get(resource.project_id, False)
    author = resource.created_by or (owners or {}).get(resource.project_id)
    return ProjectResourceResponse(
        id=resource.id,
        project_id=resource.project_id,
        project_name=resource.project.name,
        title=resource.title,
        url=resource.url,
        resource_type=resource.resource_type,
        description=resource.description,
        keywords=resource.keywords or [],
        is_pinned=is_pinned,
        is_public=bool(resource.is_public),
        created_by=(
            ResourceAuthor(
                id=author.id,
                display_name=author.display_name,
                default_avatar_key=author.default_avatar_key,
                custom_avatar_url=author.custom_avatar_url,
            )
            if author is not None
            else None
        ),
        can_manage=can_manage,
        can_toggle_public=can_toggle_public,
        created_at=resource.created_at.astimezone(timezone.utc),
        updated_at=resource.updated_at.astimezone(timezone.utc),
    )


def single_resource_response(
    db: Session, user_id: str, resource: ProjectResource, *, is_pinned: bool
) -> ProjectResourceResponse:
    access = resource_access_map(db, user_id, {resource.project_id})
    owners = project_owner_map(db, {resource.project_id}) if resource.created_by_user_id is None else None
    return resource_to_response(resource, is_pinned=is_pinned, user_id=user_id, access=access, owners=owners)


def accessible_resource_query(db: Session, user_id: str):
    return (
        db.query(ProjectResource)
        .join(Project, Project.id == ProjectResource.project_id)
        .filter(Project.is_archived.is_(False), *accessible_project_filter(user_id))
    )


def visible_resource_query(db: Session, user_id: str):
    return (
        db.query(ProjectResource)
        .join(Project, Project.id == ProjectResource.project_id)
        .filter(
            Project.is_archived.is_(False),
            or_(
                and_(*accessible_project_filter(user_id)),
                ProjectResource.is_public.is_(True),
            ),
        )
    )


def raise_if_duplicate(
    db: Session, user_id: str, url: str, *, exclude_id: str | None = None
) -> None:
    query = visible_resource_query(db, user_id).filter(ProjectResource.url == url.strip())
    if exclude_id:
        query = query.filter(ProjectResource.id != exclude_id)
    existing = query.first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This link already exists: {existing.title}",
        )


def resource_is_pinned(db: Session, user_id: str, resource_id: str) -> bool:
    return (
        db.query(ProjectResourcePin.user_id)
        .filter(
            ProjectResourcePin.user_id == user_id,
            ProjectResourcePin.resource_id == resource_id,
        )
        .first()
        is not None
    )


@router.get("", response_model=ProjectResourceListResponse)
def list_resources(
    request: Request,
    q: str | None = Query(default=None, max_length=200),
    project_id: str | None = Query(default=None, min_length=1, max_length=36),
    workspace_id: str | None = Query(default=None, min_length=1, max_length=36),
    unassigned: bool = Query(default=False),
    shared: bool = Query(default=False),
    resource_type: ResourceType | None = Query(default=None),
    created_from: date | None = Query(default=None),
    created_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1, le=100_000),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    if sum(bool(value) for value in (workspace_id, unassigned, shared)) > 1:
        raise HTTPException(
            status_code=422,
            detail="Choose only one resource scope",
        )
    user_id = get_request_auth(request).user.id
    start, end_exclusive = application_day_bounds(created_from, created_to)
    filters = []
    scope_filters = []
    include_public = False

    if project_id:
        project_id = project_id.strip()
        require_project_access(db, project_id, user_id)
        filters.append(ProjectResource.project_id == project_id)
    if workspace_id:
        require_workspace_schema(db)
        workspace_id = workspace_id.strip()
        require_workspace_owner(db, workspace_id, user_id)
        scope_filters.append(Project.workspace_id == workspace_id)
        include_public = True
    elif unassigned:
        filters.append(False)
    elif shared:
        from app.models.project_membership import ProjectMembership
        from app.models.workspace import Workspace
        include_public = True
        scope_filters.extend([
            Project.id.in_(db.query(ProjectMembership.project_id).filter(ProjectMembership.user_id == user_id)),
            Project.workspace_id.in_(db.query(Workspace.id).filter(Workspace.owner_user_id != user_id)),
        ])
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

    if include_public and not project_id:
        accessible = and_(*accessible_project_filter(user_id))
        base_query = visible_resource_query(db, user_id).filter(
            or_(
                and_(accessible, *scope_filters),
                and_(ProjectResource.is_public.is_(True), not_(accessible)),
            ),
            *filters,
        )
    elif project_id or unassigned:
        base_query = accessible_resource_query(db, user_id).filter(*scope_filters, *filters)
    else:
        base_query = visible_resource_query(db, user_id).filter(*filters)
    pin_join = and_(
        ProjectResourcePin.resource_id == ProjectResource.id,
        ProjectResourcePin.user_id == user_id,
    )
    is_pinned = ProjectResourcePin.user_id.isnot(None).label("is_pinned")
    rows = (
        base_query.outerjoin(ProjectResourcePin, pin_join)
        .options(contains_eager(ProjectResource.project))
        .add_columns(is_pinned, func.count().over().label("total_count"))
        .order_by(
            is_pinned.desc(),
            ProjectResource.created_at.desc(),
            ProjectResource.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    resources = [row[0] for row in rows]
    if rows:
        total = rows[0].total_count
    elif page > 1:
        # Past the last page the window count has no row to ride on.
        total = base_query.with_entities(func.count(ProjectResource.id)).scalar() or 0
    else:
        total = 0

    access = resource_access_map(db, user_id, {resource.project_id for resource in resources})
    owners = project_owner_map(db, {r.project_id for r in resources if r.created_by_user_id is None})
    return ProjectResourceListResponse(
        items=[
            resource_to_response(resource, is_pinned=bool(row.is_pinned), user_id=user_id, access=access, owners=owners)
            for resource, row in zip(resources, rows)
        ],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


@router.get("/{resource_id}", response_model=ProjectResourceResponse)
def get_resource(resource_id: str, request: Request, db: Session = Depends(get_db)):
    user_id = get_request_auth(request).user.id
    resource = (
        visible_resource_query(db, user_id)
        .options(joinedload(ProjectResource.project))
        .filter(ProjectResource.id == resource_id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return single_resource_response(
        db, user_id, resource, is_pinned=resource_is_pinned(db, user_id, resource.id)
    )


@router.post(
    "",
    response_model=ProjectResourceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_resource(payload: ProjectResourceCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_request_auth(request).user.id
    project = require_project_access(db, payload.project_id, user_id).project
    raise_if_duplicate(db, user_id, payload.url)
    resource = ProjectResource(
        created_by_user_id=user_id,
        is_public=False,
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
    return single_resource_response(db, user_id, resource, is_pinned=False)


@router.patch("/{resource_id}", response_model=ProjectResourceResponse)
def update_resource(
    resource_id: str,
    payload: ProjectResourceUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    resource = (
        accessible_resource_query(db, user_id)
        .options(joinedload(ProjectResource.project))
        .filter(ProjectResource.id == resource_id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "project_id" in update_data:
        require_project_access(db, resource.project_id, user_id)
        resource.project = require_project_access(db, update_data["project_id"], user_id).project
    if "resource_type" in update_data:
        update_data["resource_type"] = update_data["resource_type"].value
    if "url" in update_data and update_data["url"] is not None:
        raise_if_duplicate(db, user_id, update_data["url"], exclude_id=resource.id)

    if update_data:
        for field, value in update_data.items():
            setattr(resource, field, value)
        resource.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(resource)

    return single_resource_response(
        db, user_id, resource, is_pinned=resource_is_pinned(db, user_id, resource.id)
    )


@router.put("/{resource_id}/public", response_model=ProjectResourceResponse)
def set_resource_public(
    resource_id: str,
    payload: ResourcePublicUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    resource = (
        visible_resource_query(db, user_id)
        .options(joinedload(ProjectResource.project))
        .filter(ProjectResource.id == resource_id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    access = resource_access_map(db, user_id, {resource.project_id})
    response = resource_to_response(resource, user_id=user_id, access=access)
    if not response.can_toggle_public:
        raise HTTPException(
            status_code=403,
            detail="Only the link author can change its visibility.",
        )

    if payload.is_public and not resource.is_public:
        already_public = (
            db.query(ProjectResource)
            .join(Project, Project.id == ProjectResource.project_id)
            .filter(
                Project.is_archived.is_(False),
                ProjectResource.is_public.is_(True),
                ProjectResource.url == resource.url.strip(),
                ProjectResource.id != resource.id,
            )
            .first()
        )
        if already_public is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"This link is already public: {already_public.title}",
            )

    resource.is_public = payload.is_public
    resource.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(resource)
    return single_resource_response(
        db, user_id, resource, is_pinned=resource_is_pinned(db, user_id, resource.id)
    )


@router.put("/{resource_id}/pin", response_model=ProjectResourceResponse)
def pin_resource(resource_id: str, request: Request, db: Session = Depends(get_db)):
    user_id = get_request_auth(request).user.id
    resource = (
        visible_resource_query(db, user_id)
        .options(joinedload(ProjectResource.project))
        .filter(ProjectResource.id == resource_id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    # ON CONFLICT keeps concurrent pin requests idempotent instead of raising IntegrityError.
    db.execute(
        pg_insert(ProjectResourcePin)
        .values(user_id=user_id, resource_id=resource_id)
        .on_conflict_do_nothing(index_elements=["user_id", "resource_id"])
    )
    db.commit()

    return single_resource_response(db, user_id, resource, is_pinned=True)


@router.delete("/{resource_id}/pin", response_model=ProjectResourceResponse)
def unpin_resource(resource_id: str, request: Request, db: Session = Depends(get_db)):
    user_id = get_request_auth(request).user.id
    resource = (
        visible_resource_query(db, user_id)
        .options(joinedload(ProjectResource.project))
        .filter(ProjectResource.id == resource_id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    pin = db.get(ProjectResourcePin, (user_id, resource_id))
    if pin is not None:
        db.delete(pin)
        db.commit()

    return single_resource_response(db, user_id, resource, is_pinned=False)


@router.delete("/{resource_id}")
def delete_resource(resource_id: str, request: Request, db: Session = Depends(get_db)):
    resource = (
        accessible_resource_query(db, get_request_auth(request).user.id)
        .filter(ProjectResource.id == resource_id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    db.delete(resource)
    db.commit()
    return {"message": "Resource deleted successfully", "id": resource_id}
