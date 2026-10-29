import uuid
from datetime import datetime, timezone
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


def test_auth_status_reflects_configuration(monkeypatch):
    """Test /api/v1/auth/status when verification is disabled vs enabled."""
    client = TestClient(app, base_url="http://testserver")

    monkeypatch.setattr(auth_core, "authentication_schema_ready", lambda db: True)

    # Case 1: verification disabled
    monkeypatch.setattr(settings, "AUTH_REQUIRE_EMAIL_VERIFICATION", "false")
    res = client.get("/api/v1/auth/status")
    assert res.status_code == 200
    assert res.json()["ready"] is True
    assert res.json()["registration_available"] is True
    assert res.json()["message"] is None

    # Case 2: verification enabled but SMTP not configured
    monkeypatch.setattr(settings, "AUTH_REQUIRE_EMAIL_VERIFICATION", "true")
    monkeypatch.setattr(auth_core, "verification_email_configured", lambda: False)
    res = client.get("/api/v1/auth/status")
    assert res.status_code == 200
    assert res.json()["ready"] is True
    assert res.json()["registration_available"] is False
    assert "Registration is temporarily unavailable" in res.json()["message"]


def test_register_and_login_flow_when_verification_disabled(monkeypatch):
    """Regression test for registration and login when email verification is disabled."""
    client = TestClient(app, base_url="http://testserver")

    monkeypatch.setattr(auth_core, "authentication_schema_ready", lambda db: True)
    monkeypatch.setattr("app.api.v1.auth.enforce_rate_limit", lambda *args, **kwargs: None)
    monkeypatch.setattr("app.core.auth.enforce_rate_limit", lambda *args, **kwargs: None)
    monkeypatch.setattr(settings, "AUTH_REQUIRE_EMAIL_VERIFICATION", "false")

    sent_emails = []
    monkeypatch.setattr("app.api.v1.auth.send_verification_email", lambda email, token: sent_emails.append(email))

    stored_users = {}
    stored_accounts = {}
    stored_sessions = []

    class MockRegisterDB:
        def execute(self, *args, **kwargs):
            mock_res = MagicMock()
            mock_res.scalar.return_value = True
            return mock_res

        def query(self, *args):
            mock_q = MagicMock()
            class ResultQ:
                def filter(self, *crit):
                    return self
                def first(self):
                    return None
            return ResultQ()

        def add(self, item):
            if isinstance(item, AuthSession):
                stored_sessions.append(item)

        def add_all(self, items):
            for item in items:
                if isinstance(item, User):
                    stored_users[item.email] = item
                if isinstance(item, AuthAccount):
                    stored_accounts[item.email] = item

        def commit(self):
            pass

        def refresh(self, item):
            pass

    app.dependency_overrides[get_db] = lambda: MockRegisterDB()

    try:
        # Register with valid details
        reg_payload = {
            "display_name": "No SMTP Tester",
            "email": "test-nosmtp@example.com",
            "password": "SecurePassword123!",
        }
        res_reg = client.post(
            "/api/v1/auth/register",
            json=reg_payload,
            headers=preauth("127.0.30.1"),
        )
        assert res_reg.status_code == 201
        data = res_reg.json()
        assert data["status"] == "completed"
        assert "Account created successfully" in data["message"]
        # Ensure SMTP send email was never triggered
        assert len(sent_emails) == 0

        # Verify created account has email_verified_at set
        account = stored_accounts.get("test-nosmtp@example.com")
        assert account is not None
        assert account.email_verified_at is not None
    finally:
        app.dependency_overrides.clear()


def test_login_unverified_account_behavior_toggle(monkeypatch):
    """Test that login allows unverified accounts when verification is off, but blocks when on."""
    client = TestClient(app, base_url="http://testserver")
    monkeypatch.setattr(auth_core, "authentication_schema_ready", lambda db: True)
    monkeypatch.setattr("app.api.v1.auth.enforce_rate_limit", lambda *args, **kwargs: None)

    password = "CorrectPassword123!"
    p_hash = auth_core.hash_password(password)

    now = datetime.now(timezone.utc)
    user = User(
        id=str(uuid.uuid4()),
        display_name="Test User",
        email="unverified@example.com",
        default_avatar_key="owl",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    unverified_account = AuthAccount(
        user=user,
        email="unverified@example.com",
        password_hash=p_hash,
        email_verified_at=None,  # Unverified
    )

    class MockLoginDB:
        def __init__(self):
            self.sessions = []

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
                def first(self):
                    return unverified_account
            return MockFilter()

        def add(self, item):
            self.sessions.append(item)

        def commit(self):
            pass

        def refresh(self, item):
            pass

    app.dependency_overrides[get_db] = lambda: MockLoginDB()

    try:
        # Case A: Verification disabled -> login succeeds
        monkeypatch.setattr(settings, "AUTH_REQUIRE_EMAIL_VERIFICATION", "false")
        res_allowed = client.post(
            "/api/v1/auth/login",
            json={"email": "unverified@example.com", "password": password},
            headers=preauth("127.0.31.1"),
        )
        assert res_allowed.status_code == 200
        assert res_allowed.json()["user"]["email"] == "unverified@example.com"
        assert "mw_session" in res_allowed.cookies

        # Case B: Verification enabled -> login blocked with 403
        monkeypatch.setattr(settings, "AUTH_REQUIRE_EMAIL_VERIFICATION", "true")
        res_blocked = client.post(
            "/api/v1/auth/login",
            json={"email": "unverified@example.com", "password": password},
            headers=preauth("127.0.31.2"),
        )
        assert res_blocked.status_code == 403
        assert "Verify your email before signing in" in res_blocked.json()["detail"]

        # Case C: Invalid password -> rejected with 401
        res_wrong_pw = client.post(
            "/api/v1/auth/login",
            json={"email": "unverified@example.com", "password": "WrongPassword999!"},
            headers=preauth("127.0.31.3"),
        )
        assert res_wrong_pw.status_code == 401
    finally:
        app.dependency_overrides.clear()
