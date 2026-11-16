import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker


TEST_URL = os.getenv("TEST_AUTH_DATABASE_URL", "")
parsed = make_url(TEST_URL) if TEST_URL else None
if (
    not parsed
    or parsed.host not in {"127.0.0.1", "localhost"}
    or not (parsed.database or "").startswith("management_auth001_test_")
):
    pytest.skip(
        "TEST_AUTH_DATABASE_URL must point to the isolated local auth test database",
        allow_module_level=True,
    )

os.environ["DATABASE_URL"] = TEST_URL
os.environ["DATABASE_URL_UNPOOLED"] = TEST_URL
os.environ["AUTH_COOKIE_SECURE"] = "false"

from app.api.v1 import auth as auth_api  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.auth import AuthRateLimit  # noqa: E402
from app.models.user import User  # noqa: E402


engine = create_engine(TEST_URL, pool_pre_ping=True)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture
def client(monkeypatch):
    tokens: dict[str, str] = {}
    with TestingSession() as db:
        db.query(AuthRateLimit).delete()
        db.commit()

    def capture(email: str, token: str) -> str:
        tokens[email] = token
        return "sent"

    monkeypatch.setattr(auth_api, "send_verification_email", capture)
    monkeypatch.setattr(auth_api, "verification_email_configured", lambda: True)

    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    with TestClient(app, base_url="http://testserver") as test_client:
        test_client.verification_tokens = tokens
        yield test_client
    app.dependency_overrides.pop(get_db, None)


def preauth(ip: str) -> dict[str, str]:
    return {
        "Origin": "http://testserver",
        "X-Management-Web-Request": "1",
        "X-Forwarded-For": ip,
    }


def csrf(client: TestClient, ip: str) -> dict[str, str]:
    token = client.cookies.get("mw_csrf")
    assert token
    return {**preauth(ip), "X-CSRF-Token": token}


def register_verify_login(
    client: TestClient,
    tokens: dict[str, str],
    email: str,
    ip: str,
    name: str,
):
    password = "valid password 12345"
    created = client.post(
        "/api/v1/auth/register",
        json={"display_name": name, "email": email, "password": password},
        headers=preauth(ip),
    )
    assert created.status_code == 201, created.text
    verified = client.post(
        "/api/v1/auth/verify-email",
        json={"token": tokens[email]},
        headers=preauth(ip),
    )
    assert verified.status_code == 200, verified.text
    signed_in = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
        headers=preauth(ip),
    )
    assert signed_in.status_code == 200, signed_in.text
    return signed_in.json()["user"]


def test_registered_user_has_user_role_and_admin_api_is_forbidden(client):
    email = f"member-{uuid.uuid4().hex}@example.com"
    user = register_verify_login(
        client,
        client.verification_tokens,
        email,
        "127.2.0.1",
        "Member",
    )
    assert user["role"] == "user"
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["role"] == "user"
    forbidden = client.get("/api/v1/admin/users")
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"] == "Admin access required"


def test_admin_can_list_promote_and_lock_another_user(client):
    suffix = uuid.uuid4().hex
    admin_email = f"admin-{suffix}@example.com"
    member_email = f"managed-{suffix}@example.com"
    admin = register_verify_login(
        client,
        client.verification_tokens,
        admin_email,
        "127.2.1.1",
        "Admin",
    )

    with TestClient(app, base_url="http://testserver") as member_client:
        member = register_verify_login(
            member_client,
            client.verification_tokens,
            member_email,
            "127.2.1.2",
            "Managed User",
        )

        with TestingSession() as db:
            db.query(User).filter(User.id == admin["id"]).update({User.role: "admin"})
            db.commit()

        listed = client.get("/api/v1/admin/users")
        assert listed.status_code == 200, listed.text
        listed_ids = {item["id"] for item in listed.json()["items"]}
        assert {admin["id"], member["id"]}.issubset(listed_ids)

        promoted = client.patch(
            f"/api/v1/admin/users/{member['id']}",
            json={"role": "admin"},
            headers=csrf(client, "127.2.1.3"),
        )
        assert promoted.status_code == 200, promoted.text
        assert promoted.json()["role"] == "admin"

        locked = client.patch(
            f"/api/v1/admin/users/{member['id']}",
            json={"is_active": False},
            headers=csrf(client, "127.2.1.4"),
        )
        assert locked.status_code == 200, locked.text
        assert locked.json()["is_active"] is False
        assert member_client.get("/api/v1/auth/me").status_code == 401


def test_admin_cannot_demote_self(client):
    email = f"self-admin-{uuid.uuid4().hex}@example.com"
    admin = register_verify_login(
        client,
        client.verification_tokens,
        email,
        "127.2.2.1",
        "Self Admin",
    )
    with TestingSession() as db:
        db.query(User).filter(User.id == admin["id"]).update({User.role: "admin"})
        db.commit()

    response = client.patch(
        f"/api/v1/admin/users/{admin['id']}",
        json={"role": "user"},
        headers=csrf(client, "127.2.2.2"),
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "You cannot change your own role or status"
