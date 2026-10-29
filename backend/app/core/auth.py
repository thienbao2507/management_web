import hashlib
import hmac
import secrets
import smtplib
import ssl
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from urllib.parse import urlencode

from argon2 import PasswordHasher
try:
    from argon2.exceptions import InvalidHashError, VerifyMismatchError
except ImportError:
    from argon2.exceptions import InvalidHash as InvalidHashError, VerifyMismatchError  # type: ignore[no-redef]
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.database import get_db
from app.models.auth import AuthAccount, AuthEmailVerification, AuthRateLimit, AuthSession
from app.models.user import User


SESSION_COOKIE_MAX_AGE = settings.AUTH_SESSION_DAYS * 24 * 60 * 60
PASSWORD_HASHER = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4, hash_len=32, salt_len=16)
CSRF_HEADER = "X-CSRF-Token"
PREAUTH_HEADER = "X-Management-Web-Request"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def authentication_schema_ready(db: Session) -> bool:
    return bool(db.execute(text("""
        SELECT to_regclass('public.auth_accounts') IS NOT NULL
           AND to_regclass('public.auth_sessions') IS NOT NULL
           AND to_regclass('public.auth_email_verifications') IS NOT NULL
           AND to_regclass('public.auth_rate_limits') IS NOT NULL
    """)).scalar())


def require_authentication_schema(db: Session = Depends(get_db)) -> None:
    if not authentication_schema_ready(db):
        raise HTTPException(503, "Authentication is temporarily unavailable. Please contact the administrator.")


def verification_email_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)


def is_email_verification_required() -> bool:
    configured = settings.AUTH_REQUIRE_EMAIL_VERIFICATION
    if configured in {"true", "1", "yes", "on"}:
        return True
    if configured in {"false", "0", "no", "off"}:
        return False
    # If auto: require email verification only if SMTP is fully configured
    return verification_email_configured()


@dataclass(frozen=True)
class AuthContext:
    account: AuthAccount
    session: AuthSession
    user: User


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def token_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    return PASSWORD_HASHER.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return PASSWORD_HASHER.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def request_origin(request: Request) -> str | None:
    origin = request.headers.get("origin")
    return origin.rstrip("/") if origin else None


def allowed_origins(request: Request) -> set[str]:
    forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0].strip()
    forwarded_host = request.headers.get("x-forwarded-host", request.headers.get("host", "")).split(",")[0].strip()
    current = f"{forwarded_proto}://{forwarded_host}" if forwarded_host else ""
    return {value.rstrip("/") for value in [*settings.CORS_ORIGINS, settings.APP_BASE_URL, current] if value}


def enforce_json_origin(request: Request) -> None:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type != "application/json" or request.headers.get(PREAUTH_HEADER) != "1":
        raise HTTPException(status_code=415, detail="JSON request headers are required")
    origin = request_origin(request)
    if not origin or origin not in allowed_origins(request):
        raise HTTPException(status_code=403, detail="Request origin is not allowed")


def client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    address = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    return token_hash(address)


def enforce_rate_limit(db: Session, *, scope: str, key: str, limit: int, window_seconds: int) -> None:
    now = utcnow()
    epoch = int(now.timestamp())
    window = datetime.fromtimestamp(epoch - (epoch % window_seconds), timezone.utc)
    statement = insert(AuthRateLimit).values(
        id=str(uuid.uuid4()),
        scope=scope,
        key_hash=token_hash(key),
        window_started_at=window,
        request_count=1,
        updated_at=now,
    )
    statement = statement.on_conflict_do_update(
        constraint="uq_auth_rate_limit_window",
        set_={"request_count": AuthRateLimit.request_count + 1, "updated_at": now},
    ).returning(AuthRateLimit.request_count)
    count = db.execute(statement).scalar_one()
    db.commit()
    if count > limit:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")


def create_verification_token(db: Session, account: AuthAccount) -> str:
    now = utcnow()
    db.query(AuthEmailVerification).filter(
        AuthEmailVerification.account_id == account.id,
        AuthEmailVerification.consumed_at.is_(None),
    ).update({AuthEmailVerification.consumed_at: now})
    raw = secrets.token_urlsafe(48)
    db.add(AuthEmailVerification(
        account_id=account.id,
        token_hash=token_hash(raw),
        expires_at=now + timedelta(minutes=30),
    ))
    db.commit()
    return raw


def send_verification_email(email: str, raw_token: str) -> str:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        return "not_configured"
    query = urlencode({"verify_email_token": raw_token})
    verification_url = f"{settings.APP_BASE_URL}/?{query}#/login"
    message = EmailMessage()
    message["Subject"] = "Verify your Management Web account"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = email
    message.set_content(
        "Verify your Management Web account within 30 minutes:\n\n"
        f"{verification_url}\n\nIf you did not request this account, ignore this email."
    )
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_STARTTLS:
                smtp.starttls(context=ssl.create_default_context())
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return "sent"
    except (OSError, smtplib.SMTPException):
        return "failed"


def secure_cookie_for(request: Request) -> bool:
    configured = settings.AUTH_COOKIE_SECURE
    if configured in {"true", "1", "yes", "on"}:
        return True
    if configured in {"false", "0", "no", "off"}:
        return False
    proto = request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0].strip().lower()
    return proto == "https"


def set_auth_cookies(response: Response, request: Request, session_token: str, csrf_token: str) -> None:
    secure = secure_cookie_for(request)
    response.set_cookie(
        settings.AUTH_SESSION_COOKIE,
        session_token,
        max_age=SESSION_COOKIE_MAX_AGE,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        settings.AUTH_CSRF_COOKIE,
        csrf_token,
        max_age=SESSION_COOKIE_MAX_AGE,
        httponly=False,
        secure=secure,
        samesite="lax",
        path="/",
    )


def clear_auth_cookies(response: Response, request: Request) -> None:
    secure = secure_cookie_for(request)
    response.delete_cookie(settings.AUTH_SESSION_COOKIE, httponly=True, secure=secure, samesite="lax", path="/")
    response.delete_cookie(settings.AUTH_CSRF_COOKIE, httponly=False, secure=secure, samesite="lax", path="/")


def create_session(db: Session, account: AuthAccount) -> tuple[AuthSession, str, str]:
    session_token = secrets.token_urlsafe(48)
    csrf_token = secrets.token_urlsafe(32)
    session = AuthSession(
        account_id=account.id,
        token_hash=token_hash(session_token),
        csrf_token_hash=token_hash(csrf_token),
        expires_at=utcnow() + timedelta(days=settings.AUTH_SESSION_DAYS),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session, session_token, csrf_token


def find_auth_context(request: Request, db: Session) -> AuthContext | None:
    raw = request.cookies.get(settings.AUTH_SESSION_COOKIE)
    if not raw:
        return None
    now = utcnow()
    session = (
        db.query(AuthSession)
        .options(joinedload(AuthSession.account).joinedload(AuthAccount.user))
        .filter(
            AuthSession.token_hash == token_hash(raw),
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        )
        .first()
    )
    if not session or not session.account or not session.account.user:
        return None
    if not session.account.email_verified_at or not session.account.user.is_active:
        return None
    return AuthContext(account=session.account, session=session, user=session.account.user)


def require_authenticated_request(request: Request, db: Session = Depends(get_db)) -> AuthContext:
    context = find_auth_context(request, db)
    if not context:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    if request.method.upper() not in SAFE_METHODS:
        validate_csrf(request, context)
    request.state.auth = context
    return context


def validate_csrf(request: Request, context: AuthContext) -> None:
    origin = request_origin(request)
    if not origin or origin not in allowed_origins(request):
        raise HTTPException(status_code=403, detail="Request origin is not allowed")
    cookie_token = request.cookies.get(settings.AUTH_CSRF_COOKIE, "")
    header_token = request.headers.get(CSRF_HEADER, "")
    if not cookie_token or not header_token or not hmac.compare_digest(cookie_token, header_token):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    if not hmac.compare_digest(token_hash(header_token), context.session.csrf_token_hash):
        raise HTTPException(status_code=403, detail="CSRF validation failed")


def get_request_auth(request: Request) -> AuthContext:
    context = getattr(request.state, "auth", None)
    if not context:
        raise HTTPException(status_code=401, detail="Authentication required")
    return context
