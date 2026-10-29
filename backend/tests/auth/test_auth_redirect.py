import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from app.main import app
from app.core import auth as auth_core
from app.core.config import settings
from app.core.database import get_db
from app.models.auth import AuthAccount, AuthSession
from app.models.user import User


def preauth(ip: str = "127.0.0.1") -> dict[str, str]:
    return {"Origin": "http://testserver", "X-Management-Web-Request": "1", "X-Forwarded-For": ip}


def test_session_remains_valid_for_unverified_account_when_verification_disabled(monkeypatch):
    """Regression test for AUTH-REDIRECT-001:
    Ensure that an unverified account's session is accepted by find_auth_context / require_authenticated_request
    when AUTH_REQUIRE_EMAIL_VERIFICATION is false, preventing 401 Unauthorized redirect loops.
    """
    client = TestClient(app, base_url="http://testserver")
    monkeypatch.setattr(auth_core, "authentication_schema_ready", lambda db: True)
    monkeypatch.setattr("app.api.v1.auth.enforce_rate_limit", lambda *args, **kwargs: None)
    monkeypatch.setattr(settings, "AUTH_REQUIRE_EMAIL_VERIFICATION", "false")

    now = datetime.now(timezone.utc)
    user_id = str(uuid.uuid4())
    account_id = str(uuid.uuid4())

    user = User(
        id=user_id,
        display_name="Valid User",
        email="user@example.com",
        default_avatar_key="owl",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    account = AuthAccount(
        id=account_id,
        user=user,
        email="user@example.com",
        password_hash=auth_core.hash_password("Password123!"),
        email_verified_at=None,  # Unverified
    )

    raw_session_token = "valid_test_session_token_12345678901234567890"
    raw_csrf_token = "valid_test_csrf_token_12345678901234567890"

    session = AuthSession(
        id=str(uuid.uuid4()),
        account_id=account_id,
        account=account,
        token_hash=auth_core.token_hash(raw_session_token),
        csrf_token_hash=auth_core.token_hash(raw_csrf_token),
        expires_at=now + timedelta(days=7),
        revoked_at=None,
    )

    class MockSessionDB:
        def __init__(self):
            self.info = {"workspace_schema_ready": True}

        def execute(self, *args, **kwargs):
            mock_res = MagicMock()
            mock_res.scalar.return_value = True
            return mock_res

        def query(self, *args):
            class MockFilter:
                def options(self, *o_args):
                    return self
                def filter(self, *f_args):
                    return self
                def order_by(self, *ob_args):
                    return self
                def first(self):
                    return session
                def all(self):
                    return []
            return MockFilter()

        def commit(self):
            pass

    app.dependency_overrides[get_db] = lambda: MockSessionDB()

    try:
        # Set session cookie in client
        client.cookies.set(settings.AUTH_SESSION_COOKIE, raw_session_token)

        # 1. Access /api/v1/auth/me (Protected route used on page load / refresh)
        res_me = client.get("/api/v1/auth/me", headers=preauth("127.0.40.1"))
        assert res_me.status_code == 200, f"Expected 200 but got {res_me.status_code}: {res_me.text}"
        data_me = res_me.json()
        assert data_me["authenticated"] is True
        assert data_me["user"]["email"] == "user@example.com"

        # 2. Access /api/v1/workspaces (Protected route called immediately after login)
        res_workspaces = client.get("/api/v1/workspaces", headers=preauth("127.0.40.2"))
        # Should not be 401 Unauthorized
        assert res_workspaces.status_code != 401, "Protected route returned 401 Unauthorized for unverified session!"

        # 3. Toggle verification to TRUE -> Now unverified session must be rejected with 401
        monkeypatch.setattr(settings, "AUTH_REQUIRE_EMAIL_VERIFICATION", "true")
        res_me_blocked = client.get("/api/v1/auth/me", headers=preauth("127.0.40.3"))
        assert res_me_blocked.status_code == 401, "Expected 401 Unauthorized when verification is required"

        # 4. Inactive user -> Always rejected with 401 even if verification is disabled
        monkeypatch.setattr(settings, "AUTH_REQUIRE_EMAIL_VERIFICATION", "false")
        user.is_active = False
        res_inactive = client.get("/api/v1/auth/me", headers=preauth("127.0.40.4"))
        assert res_inactive.status_code == 401, "Expected 401 for inactive user"
    finally:
        app.dependency_overrides.clear()
