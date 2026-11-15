from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.auth import get_request_auth, require_authenticated_request
from app.core.database import get_db
from app.models.request_user import RequestUser
from app.schemas.request_user import RequestUserCreate, RequestUserResponse


router = APIRouter(
    prefix="/feedback",
    tags=["feedback"],
    dependencies=[Depends(require_authenticated_request)],
)


@router.post(
    "",
    response_model=RequestUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_feedback(
    payload: RequestUserCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    feedback = RequestUser(
        user_id=get_request_auth(request).user.id,
        category=payload.category.value,
        content=payload.content,
        images=payload.images,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback
