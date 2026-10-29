"""Explicit administrator activation of pre-authentication users; never called by public APIs."""
import secrets
from datetime import timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.auth import authentication_schema_ready, hash_password, token_hash, utcnow
from app.models.auth import AuthAccount, AuthEmailVerification
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.auth import normalize_login_email, validate_password


def inspect_legacy_mapping(db: Session, user_id: str, workspace_id: str, email: str) -> dict:
    email = normalize_login_email(email)
    user = db.get(User, user_id)
    workspace = db.get(Workspace, workspace_id)
    if not user or not user.is_active or not workspace or workspace.owner_user_id != user.id:
        raise ValueError("The exact active legacy User and owned Workspace were not found; no data was changed.")
    if user.email and normalize_login_email(user.email) != email:
        raise ValueError("The legacy User has a different email; explicit mapping review is required.")
    ready = authentication_schema_ready(db)
    if ready and db.query(AuthAccount.id).filter((AuthAccount.user_id == user_id) | (AuthAccount.email == email)).first():
        raise ValueError("An account already uses this User or email. No merge or password reset was performed.")
    counts = {}
    for label, statement in {
        "projects": "SELECT count(*) FROM projects WHERE workspace_id=:workspace_id",
        "tasks": "SELECT count(*) FROM tasks t JOIN projects p ON p.id=t.project_id WHERE p.workspace_id=:workspace_id",
        "resources": "SELECT count(*) FROM project_resources r JOIN projects p ON p.id=r.project_id WHERE p.workspace_id=:workspace_id",
    }.items():
        counts[label] = db.execute(text(statement), {"workspace_id": workspace_id}).scalar_one()
    return {"user_id": user_id, "workspace_id": workspace_id, "auth_schema_ready": ready, "preserved_records": counts}


def prepare_legacy_account(db: Session, user_id: str, workspace_id: str, email: str, password: str) -> str:
    """Caller owns transaction and email delivery. Returns a secret token only for delivery, never logging."""
    email = normalize_login_email(email)
    password = validate_password(password)
    if db.execute(text("SELECT version_num FROM alembic_version")).scalars().all() != ["c51f01d5e002"]:
        raise ValueError("Apply and verify the separately approved auth migration before activating the legacy account.")
    # Lock the same User first on concurrent activation; re-check uniqueness after the lock.
    db.query(User).filter(User.id == user_id).with_for_update().first()
    db.query(Workspace).filter(Workspace.id == workspace_id).with_for_update().first()
    inspect_legacy_mapping(db, user_id, workspace_id, email)
    user = db.get(User, user_id)
    user.email = email
    account = AuthAccount(user_id=user_id, email=email, password_hash=hash_password(password))
    db.add(account)
    db.flush()
    token = secrets.token_urlsafe(48)
    db.add(AuthEmailVerification(account_id=account.id, token_hash=token_hash(token), expires_at=utcnow() + timedelta(minutes=30)))
    db.flush()
    return token
