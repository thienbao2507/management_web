from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session, defer

from app.core.auth import get_request_auth, require_authenticated_request
from app.core.database import get_db
from app.models.request_user import RequestUser
from app.schemas.request_user import (
    MyFeedback,
    MyFeedbackListResponse,
    RequestUserCreate,
    RequestUserResponse,
)


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


@router.get("/mine", response_model=MyFeedbackListResponse)
def list_my_feedback(
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    items = (
        db.query(RequestUser)
        .options(defer(RequestUser.images))
        .filter(RequestUser.user_id == user_id)
        .order_by(RequestUser.created_at.desc(), RequestUser.id.desc())
        .all()
    )
    return MyFeedbackListResponse(
        items=[MyFeedback.model_validate(item) for item in items]
    )


@router.get("/thank-you", response_model=MyFeedbackListResponse)
def list_feedback_thank_you(
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    items = (
        db.query(RequestUser)
        .options(defer(RequestUser.images))
        .filter(
            RequestUser.user_id == user_id,
            RequestUser.thank_you_pending.is_(True),
        )
        .order_by(RequestUser.created_at.desc(), RequestUser.id.desc())
        .all()
    )
    return MyFeedbackListResponse(
        items=[MyFeedback.model_validate(item) for item in items]
    )


@router.post(
    "/{feedback_id}/thank-you/ack",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def acknowledge_feedback_thank_you(
    feedback_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = get_request_auth(request).user.id
    feedback = (
        db.query(RequestUser)
        .options(defer(RequestUser.images))
        .filter(
            RequestUser.id == feedback_id,
            RequestUser.user_id == user_id,
        )
        .with_for_update()
        .first()
    )
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    if feedback.thank_you_pending:
        feedback.thank_you_pending = False
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
