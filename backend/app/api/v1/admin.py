from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, defer, joinedload

from app.core.auth import AuthContext, require_admin, utcnow
from app.core.database import get_db
from app.models.auth import AuthAccount, AuthSession
from app.models.request_user import RequestUser
from app.models.user import User
from app.schemas.request_user import (
    AdminFeedbackCounts,
    AdminFeedbackDetail,
    AdminFeedbackListResponse,
    AdminFeedbackSummary,
    AdminFeedbackUpdate,
    AdminFeedbackUser,
    FeedbackCategory,
    FeedbackStatus,
)
from app.schemas.user import (
    AdminUserListResponse,
    AdminUserResponse,
    AdminUserUpdate,
    UserResponse,
)


router = APIRouter(
    prefix="/admin/users",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)

admin_feedback_router = APIRouter(
    prefix="/admin/feedback",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


def _admin_feedback_summary(
    feedback: RequestUser,
    image_count: int | None = None,
) -> AdminFeedbackSummary:
    feedback_user = (
        AdminFeedbackUser.model_validate(feedback.user)
        if feedback.user is not None
        else None
    )
    return AdminFeedbackSummary(
        id=feedback.id,
        category=feedback.category,
        content=feedback.content,
        status=feedback.status,
        admin_note=feedback.admin_note,
        image_count=(
            image_count if image_count is not None else len(feedback.images or [])
        ),
        created_at=feedback.created_at,
        updated_at=feedback.updated_at,
        user=feedback_user,
    )


def _admin_feedback_detail(feedback: RequestUser) -> AdminFeedbackDetail:
    summary = _admin_feedback_summary(feedback)
    return AdminFeedbackDetail(
        **summary.model_dump(),
        images=list(feedback.images or []),
    )


@admin_feedback_router.get("", response_model=AdminFeedbackListResponse)
def list_admin_feedback(
    feedback_status: FeedbackStatus | None = Query(None, alias="status"),
    category: FeedbackCategory | None = Query(None),
    q: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    count_rows = (
        db.query(RequestUser.status, func.count(RequestUser.id))
        .group_by(RequestUser.status)
        .all()
    )
    count_values = {item.value: 0 for item in FeedbackStatus}
    count_values.update({item_status: count for item_status, count in count_rows})

    # Images are base64 data URLs (up to ~900 KB each): count them in SQL, never load them for the list.
    query = db.query(
        RequestUser,
        func.coalesce(func.json_array_length(RequestUser.images), 0).label("image_count"),
    ).options(defer(RequestUser.images), joinedload(RequestUser.user))
    if feedback_status is not None:
        query = query.filter(RequestUser.status == feedback_status.value)
    if category is not None:
        query = query.filter(RequestUser.category == category.value)

    search = q.strip() if q else ""
    if search:
        pattern = f"%{search}%"
        query = query.outerjoin(User, RequestUser.user_id == User.id).filter(
            or_(
                RequestUser.content.ilike(pattern),
                User.display_name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )

    total = query.count()
    feedback_items = (
        query.order_by(RequestUser.created_at.desc(), RequestUser.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return AdminFeedbackListResponse(
        items=[
            _admin_feedback_summary(item, image_count)
            for item, image_count in feedback_items
        ],
        total=total,
        page=page,
        page_size=page_size,
        counts=AdminFeedbackCounts(**count_values),
    )


@admin_feedback_router.get(
    "/{feedback_id}",
    response_model=AdminFeedbackDetail,
)
def get_admin_feedback(
    feedback_id: str,
    db: Session = Depends(get_db),
):
    feedback = (
        db.query(RequestUser)
        .options(joinedload(RequestUser.user))
        .filter(RequestUser.id == feedback_id)
        .first()
    )
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return _admin_feedback_detail(feedback)


@admin_feedback_router.patch(
    "/{feedback_id}",
    response_model=AdminFeedbackDetail,
)
def update_admin_feedback(
    feedback_id: str,
    payload: AdminFeedbackUpdate,
    db: Session = Depends(get_db),
):
    feedback = (
        db.query(RequestUser)
        .filter(RequestUser.id == feedback_id)
        .with_for_update()
        .first()
    )
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    changed = False
    if "status" in payload.model_fields_set and payload.status is not None:
        next_status = payload.status.value
        if feedback.status != next_status:
            if next_status == FeedbackStatus.DONE.value:
                feedback.thank_you_pending = True
            elif feedback.status == FeedbackStatus.DONE.value:
                feedback.thank_you_pending = False
            feedback.status = next_status
            changed = True

    if "admin_note" in payload.model_fields_set:
        if feedback.admin_note != payload.admin_note:
            feedback.admin_note = payload.admin_note
            changed = True

    if changed:
        feedback.updated_at = utcnow()
        db.commit()
        db.refresh(feedback)

    return _admin_feedback_detail(feedback)


@router.get("", response_model=AdminUserListResponse)
def list_admin_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
):
    last_login_subquery = (
        db.query(
            AuthAccount.user_id.label("user_id"),
            func.max(AuthSession.created_at).label("last_login_at"),
        )
        .join(AuthSession, AuthSession.account_id == AuthAccount.id)
        .group_by(AuthAccount.user_id)
        .subquery()
    )
    query = db.query(
        User,
        last_login_subquery.c.last_login_at,
    ).outerjoin(
        last_login_subquery,
        last_login_subquery.c.user_id == User.id,
    )
    search = q.strip() if q else ""
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(User.display_name.ilike(pattern), User.email.ilike(pattern))
        )

    total = query.count()
    items = (
        query.order_by(User.created_at.asc(), User.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return AdminUserListResponse(
        items=[
            AdminUserResponse(
                **UserResponse.model_validate(user).model_dump(),
                last_login_at=last_login_at,
            )
            for user, last_login_at in items
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/{user_id}", response_model=UserResponse)
def update_admin_user(
    user_id: str,
    payload: AdminUserUpdate,
    context: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    next_role = payload.role if payload.role is not None else user.role
    next_is_active = (
        payload.is_active if payload.is_active is not None else user.is_active
    )
    if user.id == context.user.id and (
        next_role != user.role or not next_is_active
    ):
        raise HTTPException(
            status_code=400,
            detail="You cannot change your own role or status",
        )

    removes_active_admin = (
        user.role == "admin"
        and user.is_active
        and (next_role != "admin" or not next_is_active)
    )
    if removes_active_admin:
        active_admins = len(
            db.query(User.id)
            .filter(User.role == "admin", User.is_active.is_(True))
            .with_for_update()
            .all()
        )
        if active_admins <= 1:
            raise HTTPException(
                status_code=400,
                detail="At least one active admin is required",
            )

    user.role = next_role
    user.is_active = next_is_active
    user.updated_at = utcnow()
    db.commit()
    db.refresh(user)
    return user
