import base64
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.auth import get_request_auth, require_authenticated_request
from app.core.database import get_db
from app.models.user import User
from app.models.user_avatar import UserAvatar
from app.schemas.user_avatar import (
    AVATAR_IMAGE_DATA_URL_PATTERN,
    UserAvatarResponse,
    UserAvatarUpload,
)


router = APIRouter(
    tags=["avatars"],
    dependencies=[Depends(require_authenticated_request)],
)


def avatar_url(user_id: str, updated_at: datetime) -> str:
    version = int(updated_at.timestamp() * 1_000_000)
    return f"/api/v1/user-avatars/{user_id}?v={version}"


@router.put("/users/me/avatar", response_model=UserAvatarResponse)
def save_my_avatar(
    payload: UserAvatarUpload,
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    user = db.get(User, user_id)
    avatar = db.get(UserAvatar, user_id)
    updated_at = datetime.now(timezone.utc)

    if avatar is None:
        avatar = UserAvatar(
            user_id=user_id,
            image=payload.image,
            updated_at=updated_at,
        )
        db.add(avatar)
    else:
        avatar.image = payload.image
        avatar.updated_at = updated_at

    custom_avatar_url = avatar_url(user_id, updated_at)
    user.custom_avatar_url = custom_avatar_url
    db.commit()
    return UserAvatarResponse(custom_avatar_url=custom_avatar_url)


@router.delete(
    "/users/me/avatar",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_my_avatar(
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    user = db.get(User, user_id)
    avatar = db.get(UserAvatar, user_id)

    if avatar is not None:
        db.delete(avatar)
    user.custom_avatar_url = None
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/user-avatars/{user_id}")
def get_user_avatar(
    user_id: str,
    db: Session = Depends(get_db),
):
    avatar = db.get(UserAvatar, user_id)
    if avatar is None:
        raise HTTPException(status_code=404, detail="Avatar not found")

    match = AVATAR_IMAGE_DATA_URL_PATTERN.fullmatch(avatar.image)
    if match is None:
        raise HTTPException(status_code=404, detail="Avatar not found")

    return Response(
        content=base64.b64decode(match.group(2), validate=True),
        media_type=f"image/{match.group(1)}",
        headers={
            "Cache-Control": "private, max-age=31536000, immutable",
        },
    )
