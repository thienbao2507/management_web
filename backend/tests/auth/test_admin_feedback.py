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
from app.models.request_user import RequestUser  # noqa: E402
from app.models.user import User  # noqa: E402


engine = create_engine(TEST_URL, pool_pre_ping=True)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture
def client(monkeypatch):
    tokens: dict[str, str] = {}
    with TestingSession() as db:
        db.query(RequestUser).delete()
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


def test_regular_user_cannot_list_admin_feedback(client):
    suffix = uuid.uuid4().hex
    register_verify_login(
        client,
        client.verification_tokens,
        f"member-{suffix}@example.com",
        "127.3.0.1",
        "Member",
    )

    response = client.get("/api/v1/admin/feedback")

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"


def test_admin_feedback_flow_and_last_login(client):
    suffix = uuid.uuid4().hex
    admin = register_verify_login(
        client,
        client.verification_tokens,
        f"admin-{suffix}@example.com",
        "127.3.1.1",
        "Feedback Admin",
    )

    with TestClient(app, base_url="http://testserver") as member_client:
        member = register_verify_login(
            member_client,
            client.verification_tokens,
            f"member-{suffix}@example.com",
            "127.3.1.2",
            "Feedback Member",
        )
        with TestClient(app, base_url="http://testserver") as other_client:
            register_verify_login(
                other_client,
                client.verification_tokens,
                f"other-{suffix}@example.com",
                "127.3.1.3",
                "Other Member",
            )

            with TestingSession() as db:
                db.query(User).filter(User.id == admin["id"]).update(
                    {User.role: "admin"}
                )
                db.commit()

            first = member_client.post(
                "/api/v1/feedback",
                json={"category": "bug", "content": "First feedback", "images": []},
                headers=csrf(member_client, "127.3.1.4"),
            )
            assert first.status_code == 201, first.text
            first_id = first.json()["id"]

            second = member_client.post(
                "/api/v1/feedback",
                json={
                    "category": "feature",
                    "content": "Second feedback",
                    "images": [],
                },
                headers=csrf(member_client, "127.3.1.5"),
            )
            assert second.status_code == 201, second.text

            listed = client.get("/api/v1/admin/feedback")
            assert listed.status_code == 200, listed.text
            assert listed.json()["total"] == 2
            assert listed.json()["counts"] == {
                "new": 2,
                "in_progress": 0,
                "done": 0,
                "rejected": 0,
            }

            filtered = client.get("/api/v1/admin/feedback", params={"status": "new"})
            assert filtered.status_code == 200, filtered.text
            assert filtered.json()["total"] == 2
            assert all(item["status"] == "new" for item in filtered.json()["items"])

            detail = client.get(f"/api/v1/admin/feedback/{first_id}")
            assert detail.status_code == 200, detail.text
            assert detail.json()["image_count"] == 0
            assert detail.json()["images"] == []
            assert detail.json()["user"]["id"] == member["id"]

            completed = client.patch(
                f"/api/v1/admin/feedback/{first_id}",
                json={"status": "done", "admin_note": "  handled internally  "},
                headers=csrf(client, "127.3.1.6"),
            )
            assert completed.status_code == 200, completed.text
            assert completed.json()["status"] == "done"
            assert completed.json()["admin_note"] == "handled internally"

            done_items = client.get(
                "/api/v1/admin/feedback",
                params={"status": "done"},
            )
            assert done_items.status_code == 200, done_items.text
            assert done_items.json()["total"] == 1
            assert done_items.json()["items"][0]["id"] == first_id
            assert done_items.json()["counts"] == {
                "new": 1,
                "in_progress": 0,
                "done": 1,
                "rejected": 0,
            }

            thank_you = member_client.get("/api/v1/feedback/thank-you")
            assert thank_you.status_code == 200, thank_you.text
            assert [item["id"] for item in thank_you.json()["items"]] == [first_id]

            mine = member_client.get("/api/v1/feedback/mine")
            assert mine.status_code == 200, mine.text
            assert len(mine.json()["items"]) == 2
            assert all("admin_note" not in item for item in mine.json()["items"])

            wrong_user_ack = other_client.post(
                f"/api/v1/feedback/{first_id}/thank-you/ack",
                headers=csrf(other_client, "127.3.1.7"),
            )
            assert wrong_user_ack.status_code == 404

            acknowledged = member_client.post(
                f"/api/v1/feedback/{first_id}/thank-you/ack",
                headers=csrf(member_client, "127.3.1.8"),
            )
            assert acknowledged.status_code == 204, acknowledged.text
            assert member_client.get("/api/v1/feedback/thank-you").json()["items"] == []

            users = client.get("/api/v1/admin/users")
            assert users.status_code == 200, users.text
            member_row = next(
                item for item in users.json()["items"] if item["id"] == member["id"]
            )
            assert member_row["last_login_at"] is not None
