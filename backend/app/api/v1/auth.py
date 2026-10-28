import uuid
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.auth import (
    PASSWORD_HASHER,
    AuthContext,
    clear_auth_cookies,
    client_key,
    create_session,
    create_verification_token,
    enforce_json_origin,
    enforce_rate_limit,
    find_auth_context,
    hash_password,
    require_authenticated_request,
    send_verification_email,
    set_auth_cookies,
    token_hash,
    utcnow,
    validate_csrf,
    verify_password,
)
from app.core.database import get_db
from app.models.auth import AuthAccount, AuthEmailVerification, AuthSession
from app.models.user import User, avatar_key_for_id
from app.schemas.auth import (
    AuthMessageResponse,
    AuthSessionResponse,
    CurrentAuthResponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    VerifyEmailRequest,
)


router = APIRouter(prefix="/auth", tags=["auth"])
DUMMY_PASSWORD_HASH = hash_password("not-a-real-password-value")


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    enforce_json_origin(request)
    enforce_rate_limit(db, scope="register-ip", key=client_key(request), limit=5, window_seconds=3600)
    enforce_rate_limit(db, scope="register-email", key=payload.email, limit=3, window_seconds=3600)

    if db.query(AuthAccount.id).filter(AuthAccount.email == payload.email).first():
        raise HTTPException(status_code=409, detail="An account already exists for this email")

    user_id = str(uuid.uuid4())
    user = User(
        id=user_id,
        display_name=payload.display_name,
        email=payload.email,
        default_avatar_key=avatar_key_for_id(user_id),
        is_active=True,
    )
    account = AuthAccount(user=user, email=payload.email, password_hash=hash_password(payload.password))
    db.add_all([user, account])
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account already exists for this email") from error
    db.refresh(account)
    raw_token = create_verification_token(db, account)
    delivery = send_verification_email(account.email, raw_token)
    return RegisterResponse(
        status="pending_verification",
        message="Account created. Verify your email before signing in.",
        email_delivery=delivery,
    )


@router.post("/verify-email", response_model=AuthMessageResponse)
def verify_email(payload: VerifyEmailRequest, request: Request, db: Session = Depends(get_db)):
    enforce_json_origin(request)
    enforce_rate_limit(db, scope="verify-ip", key=client_key(request), limit=10, window_seconds=900)
    now = utcnow()
    verification = (
        db.query(AuthEmailVerification)
        .filter(AuthEmailVerification.token_hash == token_hash(payload.token))
        .with_for_update()
        .first()
    )
    if not verification or verification.consumed_at or verification.expires_at.astimezone(timezone.utc) <= now:
        raise HTTPException(status_code=400, detail="Verification token is invalid or expired")
    verification.consumed_at = now
    verification.account.email_verified_at = verification.account.email_verified_at or now
    db.query(AuthEmailVerification).filter(
        AuthEmailVerification.account_id == verification.account_id,
        AuthEmailVerification.id != verification.id,
        AuthEmailVerification.consumed_at.is_(None),
    ).update({AuthEmailVerification.consumed_at: now})
    db.commit()
    return {"message": "Email verified. You can now sign in."}


@router.post("/resend-verification", response_model=AuthMessageResponse)
def resend_verification(payload: ResendVerificationRequest, request: Request, db: Session = Depends(get_db)):
    enforce_json_origin(request)
    enforce_rate_limit(db, scope="resend-ip", key=client_key(request), limit=5, window_seconds=3600)
    enforce_rate_limit(db, scope="resend-email", key=payload.email, limit=3, window_seconds=3600)
    account = db.query(AuthAccount).filter(AuthAccount.email == payload.email).first()
    if account and not account.email_verified_at and account.user and account.user.is_active:
        raw_token = create_verification_token(db, account)
        send_verification_email(account.email, raw_token)
    return {"message": "If an unverified active account exists, a new verification email has been requested."}


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    enforce_json_origin(request)
    key = f"{client_key(request)}:{payload.email}"
    enforce_rate_limit(db, scope="login", key=key, limit=8, window_seconds=900)
    account = (
        db.query(AuthAccount)
        .options(joinedload(AuthAccount.user))
        .filter(AuthAccount.email == payload.email)
        .first()
    )
    valid = verify_password(account.password_hash if account else DUMMY_PASSWORD_HASH, payload.password)
    if not account or not valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not account.email_verified_at:
        raise HTTPException(status_code=403, detail="Verify your email before signing in")
    if not account.user or not account.user.is_active:
        raise HTTPException(status_code=403, detail="This account is inactive")
    if PASSWORD_HASHER.check_needs_rehash(account.password_hash):
        account.password_hash = hash_password(payload.password)
        db.commit()
    _, session_token, csrf_token = create_session(db, account)
    set_auth_cookies(response, request, session_token, csrf_token)
    return {"user": account.user, "csrf_header": "X-CSRF-Token"}


@router.get("/me", response_model=CurrentAuthResponse)
def me(context: AuthContext = Depends(require_authenticated_request)):
    return {"user": context.user, "csrf_header": "X-CSRF-Token", "authenticated": True}


@router.post("/logout", response_model=AuthMessageResponse)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    enforce_json_origin(request)
    context = find_auth_context(request, db)
    if context:
        validate_csrf(request, context)
        context.session.revoked_at = utcnow()
        db.commit()
    else:
        from app.core.config import settings
        raw = request.cookies.get(settings.AUTH_SESSION_COOKIE)
        if raw:
            session = db.query(AuthSession).filter(AuthSession.token_hash == token_hash(raw)).first()
            if session and not session.revoked_at:
                session.revoked_at = utcnow()
                db.commit()
    clear_auth_cookies(response, request)
    return {"message": "Signed out"}
