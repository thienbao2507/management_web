from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from app.core.auth import get_request_auth, require_authenticated_request
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserListResponse, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_authenticated_request)])


@router.get("", response_model=UserListResponse)
def list_users(request: Request, page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=200)):
    user = get_request_auth(request).user
    items = [user] if page == 1 else []
    return {"items": items, "total": 1, "page": page, "page_size": page_size}


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, request: Request):
    user = get_request_auth(request).user
    if user.id != user_id:
        raise HTTPException(404, "User not found")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, payload: UserUpdate, request: Request, db: Session = Depends(get_db)):
    current = get_request_auth(request).user
    if current.id != user_id:
        raise HTTPException(404, "User not found")
    user = db.get(User, current.id)
    changes = payload.model_dump(exclude_unset=True)
    if changes:
        for field, value in changes.items():
            setattr(user, field, value)
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
    return user
