from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, require_admin, utcnow
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import AdminUserListResponse, AdminUserUpdate, UserResponse


router = APIRouter(
    prefix="/admin/users",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=AdminUserListResponse)
def list_admin_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(User)
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
        items=[UserResponse.model_validate(user) for user in items],
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
