from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.auth import get_request_auth, require_authenticated_request
from app.core.authorization import accessible_project_filter, require_project_access
from app.core.database import get_db
from app.models.project import Project
from app.models.whiteboard import Whiteboard
from app.schemas.whiteboard import (
    WhiteboardCreate,
    WhiteboardDetail,
    WhiteboardListResponse,
    WhiteboardRename,
    WhiteboardSceneSaveResponse,
    WhiteboardSceneUpdate,
    WhiteboardSummary,
)


router = APIRouter(
    prefix="/whiteboards",
    tags=["whiteboards"],
    dependencies=[Depends(require_authenticated_request)],
)

MAX_WHITEBOARD_BODY_BYTES = 4_000_000


def accessible_whiteboard_query(db: Session, user_id: str):
    return (
        db.query(Whiteboard)
        .join(Project, Project.id == Whiteboard.project_id)
        .filter(Project.is_archived.is_(False), *accessible_project_filter(user_id))
    )


def whiteboard_to_summary(whiteboard: Whiteboard) -> WhiteboardSummary:
    return WhiteboardSummary(
        id=whiteboard.id,
        project_id=whiteboard.project_id,
        title=whiteboard.title,
        version=whiteboard.version,
        created_at=whiteboard.created_at,
        updated_at=whiteboard.updated_at,
        updated_by_name=(
            whiteboard.updated_by.display_name if whiteboard.updated_by else None
        ),
    )


def whiteboard_to_detail(whiteboard: Whiteboard) -> WhiteboardDetail:
    return WhiteboardDetail(
        **whiteboard_to_summary(whiteboard).model_dump(),
        scene=whiteboard.scene,
    )


def get_accessible_whiteboard(
    db: Session,
    whiteboard_id: str,
    user_id: str,
) -> Whiteboard:
    whiteboard = (
        accessible_whiteboard_query(db, user_id)
        .filter(Whiteboard.id == whiteboard_id)
        .first()
    )
    if not whiteboard:
        raise HTTPException(status_code=404, detail="Whiteboard not found")
    return whiteboard


async def require_body_within_limit(request: Request) -> None:
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_WHITEBOARD_BODY_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Whiteboard is too large (max 4 MB)",
                )
        except ValueError:
            pass

    if len(await request.body()) > MAX_WHITEBOARD_BODY_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Whiteboard is too large (max 4 MB)",
        )


@router.get("", response_model=WhiteboardListResponse)
def list_whiteboards(
    request: Request,
    project_id: str = Query(min_length=1, max_length=36),
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    project_id = project_id.strip()
    require_project_access(db, project_id, user_id)
    whiteboards = (
        accessible_whiteboard_query(db, user_id)
        .filter(Whiteboard.project_id == project_id)
        .order_by(Whiteboard.updated_at.desc(), Whiteboard.id.desc())
        .all()
    )
    return WhiteboardListResponse(
        items=[whiteboard_to_summary(whiteboard) for whiteboard in whiteboards]
    )


@router.post(
    "",
    response_model=WhiteboardDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_whiteboard(
    payload: WhiteboardCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    require_project_access(db, payload.project_id, user_id)
    whiteboard = Whiteboard(
        project_id=payload.project_id,
        title=payload.title,
        scene={},
        version=1,
        created_by_id=user_id,
        updated_by_id=user_id,
    )
    db.add(whiteboard)
    db.commit()
    created = get_accessible_whiteboard(db, whiteboard.id, user_id)
    return whiteboard_to_detail(created)


@router.get("/{whiteboard_id}", response_model=WhiteboardDetail)
def get_whiteboard(
    whiteboard_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    whiteboard = get_accessible_whiteboard(
        db,
        whiteboard_id,
        get_request_auth(request).user.id,
    )
    return whiteboard_to_detail(whiteboard)


@router.patch("/{whiteboard_id}", response_model=WhiteboardSummary)
def rename_whiteboard(
    whiteboard_id: str,
    payload: WhiteboardRename,
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    whiteboard = get_accessible_whiteboard(db, whiteboard_id, user_id)
    whiteboard.title = payload.title
    whiteboard.updated_by_id = user_id
    whiteboard.updated_at = datetime.now(timezone.utc)
    db.commit()
    updated = get_accessible_whiteboard(db, whiteboard_id, user_id)
    return whiteboard_to_summary(updated)


@router.put("/{whiteboard_id}/scene", response_model=WhiteboardSceneSaveResponse)
async def save_whiteboard_scene(
    whiteboard_id: str,
    payload: WhiteboardSceneUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    await require_body_within_limit(request)
    user_id = get_request_auth(request).user.id
    whiteboard = (
        accessible_whiteboard_query(db, user_id)
        .filter(Whiteboard.id == whiteboard_id)
        .with_for_update(of=Whiteboard)
        .first()
    )
    if not whiteboard:
        raise HTTPException(status_code=404, detail="Whiteboard not found")
    if payload.base_version != whiteboard.version:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": "Whiteboard was changed by someone else",
                "version": whiteboard.version,
            },
        )

    whiteboard.scene = payload.scene
    whiteboard.version += 1
    whiteboard.updated_by_id = user_id
    whiteboard.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(whiteboard)
    return WhiteboardSceneSaveResponse(
        id=whiteboard.id,
        version=whiteboard.version,
        updated_at=whiteboard.updated_at,
    )


@router.delete("/{whiteboard_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_whiteboard(
    whiteboard_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    whiteboard = get_accessible_whiteboard(
        db,
        whiteboard_id,
        get_request_auth(request).user.id,
    )
    db.delete(whiteboard)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
