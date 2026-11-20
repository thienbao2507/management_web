import base64
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
    email: str,
    ip: str,
    name: str,
) -> dict:
    password = "valid password 12345"
    registered = client.post(
        "/api/v1/auth/register",
        json={"display_name": name, "email": email, "password": password},
        headers=preauth(ip),
    )
    assert registered.status_code == 201, registered.text
    verified = client.post(
        "/api/v1/auth/verify-email",
        json={"token": client.verification_tokens[email]},
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


def test_avatar_upload_read_and_delete(client):
    suffix = uuid.uuid4().hex
    owner = register_verify_login(
        client,
        f"avatar-owner-{suffix}@example.com",
        "127.4.1.1",
        "Avatar Owner",
    )
    image_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    )
    image = f"data:image/png;base64,{base64.b64encode(image_bytes).decode()}"

    uploaded = client.put(
        "/api/v1/users/me/avatar",
        json={"image": image},
        headers=csrf(client, "127.4.1.2"),
    )
    assert uploaded.status_code == 200, uploaded.text
    avatar_url = uploaded.json()["custom_avatar_url"]
    assert avatar_url.startswith(f"/api/v1/user-avatars/{owner['id']}?v=")

    fetched = client.get(avatar_url)
    assert fetched.status_code == 200
    assert fetched.content == image_bytes
    assert fetched.headers["content-type"] == "image/png"
    assert fetched.headers["cache-control"] == "private, max-age=31536000, immutable"

    with TestingSession() as db:
        assert db.get(User, owner["id"]).custom_avatar_url == avatar_url

    with TestClient(app, base_url="http://testserver") as other_client:
        other_client.verification_tokens = client.verification_tokens
        register_verify_login(
            other_client,
            f"avatar-reader-{suffix}@example.com",
            "127.4.2.1",
            "Avatar Reader",
        )
        other_fetched = other_client.get(avatar_url)
        assert other_fetched.status_code == 200
        assert other_fetched.content == image_bytes

    with TestClient(app, base_url="http://testserver") as anonymous_client:
        assert anonymous_client.get(avatar_url).status_code == 401

    deleted = client.delete(
        "/api/v1/users/me/avatar",
        headers=csrf(client, "127.4.1.3"),
    )
    assert deleted.status_code == 204
    assert client.get(avatar_url).status_code == 404
    with TestingSession() as db:
        assert db.get(User, owner["id"]).custom_avatar_url is None


def test_avatar_upload_rejects_invalid_and_oversized_data(client):
    suffix = uuid.uuid4().hex
    register_verify_login(
        client,
        f"avatar-validation-{suffix}@example.com",
        "127.4.3.1",
        "Avatar Validation",
    )

    invalid = client.put(
        "/api/v1/users/me/avatar",
        json={"image": "not-an-image-data-url"},
        headers=csrf(client, "127.4.3.2"),
    )
    assert invalid.status_code == 422

    invalid_base64 = client.put(
        "/api/v1/users/me/avatar",
        json={"image": "data:image/png;base64,%%%"},
        headers=csrf(client, "127.4.3.3"),
    )
    assert invalid_base64.status_code == 422

    oversized = base64.b64encode(b"x" * (200 * 1024 + 1)).decode()
    too_large = client.put(
        "/api/v1/users/me/avatar",
        json={"image": f"data:image/webp;base64,{oversized}"},
        headers=csrf(client, "127.4.3.4"),
    )
    assert too_large.status_code == 422
