import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User, avatar_key_for_id
from app.schemas.user import UserCreate, UserListResponse, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=UserListResponse)
def list_users(include_inactive: bool = False, page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=200), db: Session = Depends(get_db)):
    query = db.query(User)
    if not include_inactive:
        query = query.filter(User.is_active.is_(True))
    return {"items": query.order_by(User.display_name, User.id).offset((page - 1) * page_size).limit(page_size).all(), "total": query.count(), "page": page, "page_size": page_size}


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.post("", response_model=UserResponse, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    user_id = str(uuid.uuid4())
    user = User(id=user_id, default_avatar_key=avatar_key_for_id(user_id), **payload.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, payload: UserUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    changes = payload.model_dump(exclude_unset=True)
    if changes:
        for field, value in changes.items():
            setattr(user, field, value)
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
    return user
