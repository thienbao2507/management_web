from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.auth import get_request_auth, require_authenticated_request
from app.core.database import get_db
from app.models.user_background import UserBackground
from app.schemas.user_background import (
    UserBackgroundDimUpdate,
    UserBackgroundEnvelope,
    UserBackgroundResponse,
    UserBackgroundSave,
)


router = APIRouter(
    prefix="/me/background",
    tags=["background"],
    dependencies=[Depends(require_authenticated_request)],
)


@router.get("", response_model=UserBackgroundEnvelope)
def get_my_background(
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    return UserBackgroundEnvelope(background=db.get(UserBackground, user_id))


@router.put("", response_model=UserBackgroundResponse)
def save_my_background(
    payload: UserBackgroundSave,
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    background = db.get(UserBackground, user_id)
    updated_at = datetime.now(timezone.utc)

    if background is None:
        background = UserBackground(
            user_id=user_id,
            image=payload.image,
            dim=payload.dim,
            updated_at=updated_at,
        )
        db.add(background)
    else:
        background.image = payload.image
        background.dim = payload.dim
        background.updated_at = updated_at

    db.commit()
    db.refresh(background)
    return background


@router.patch("", response_model=UserBackgroundResponse)
def update_my_background_dim(
    payload: UserBackgroundDimUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    background = db.get(UserBackground, user_id)
    if background is None:
        raise HTTPException(status_code=404, detail="Background not found")

    background.dim = payload.dim
    background.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(background)
    return background


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_my_background(
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    background = db.get(UserBackground, user_id)
    if background is not None:
        db.delete(background)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
