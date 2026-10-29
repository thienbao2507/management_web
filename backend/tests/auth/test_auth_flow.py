import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker


TEST_URL = os.getenv("TEST_AUTH_DATABASE_URL", "")
parsed = make_url(TEST_URL) if TEST_URL else None
if not parsed or parsed.host not in {"127.0.0.1", "localhost"} or not (parsed.database or "").startswith("management_auth001_test_"):
    pytest.skip("TEST_AUTH_DATABASE_URL must point to the isolated local auth test database", allow_module_level=True)

os.environ["DATABASE_URL"] = TEST_URL
os.environ["DATABASE_URL_UNPOOLED"] = TEST_URL
os.environ["AUTH_COOKIE_SECURE"] = "false"

from app.api.v1 import auth as auth_api  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.auth import AuthAccount, AuthRateLimit, AuthSession  # noqa: E402
from app.models.project import Project  # noqa: E402
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
    return {"Origin": "http://testserver", "X-Management-Web-Request": "1", "X-Forwarded-For": ip}


def csrf(client: TestClient, ip: str = "127.0.10.1") -> dict[str, str]:
    token = client.cookies.get("mw_csrf")
    assert token
    return {**preauth(ip), "X-CSRF-Token": token}


def register_verify_login(client: TestClient, email: str, ip: str, name: str = "Auth User"):
    password = "valid password 12345"
    response = client.post("/api/v1/auth/register", json={"display_name": name, "email": email, "password": password}, headers=preauth(ip))
    assert response.status_code == 201, response.text
    assert response.json()["email_delivery"] == "sent"
    token = client.verification_tokens[email]
    verified = client.post("/api/v1/auth/verify-email", json={"token": token}, headers=preauth(ip))
    assert verified.status_code == 200, verified.text
    signed_in = client.post("/api/v1/auth/login", json={"email": email, "password": password}, headers=preauth(ip))
    assert signed_in.status_code == 200, signed_in.text
    body = signed_in.json()
    assert "password_hash" not in signed_in.text and "token" not in body
    return body["user"]


def test_register_verify_session_csrf_and_logout(client):
    suffix = uuid.uuid4().hex
    email = f"owner-{suffix}@example.com"
    password = "valid password 12345"
    created = client.post("/api/v1/auth/register", json={"display_name": "Owner", "email": f"  {email.upper()}  ", "password": password}, headers=preauth("127.0.11.1"))
    assert created.status_code == 201
    assert "password" not in created.text.lower() and "token" not in created.text.lower()

    duplicate = client.post("/api/v1/auth/register", json={"display_name": "Other", "email": email, "password": password}, headers=preauth("127.0.11.2"))
    assert duplicate.status_code == 409
    unverified = client.post("/api/v1/auth/login", json={"email": email, "password": password}, headers=preauth("127.0.11.3"))
    assert unverified.status_code == 403

    token = client.verification_tokens[email]
    assert client.post("/api/v1/auth/verify-email", json={"token": token}, headers=preauth("127.0.11.4")).status_code == 200
    assert client.post("/api/v1/auth/verify-email", json={"token": token}, headers=preauth("127.0.11.5")).status_code == 400
    assert client.post("/api/v1/auth/login", json={"email": email, "password": "wrong"}, headers=preauth("127.0.11.6")).status_code == 401

    login = client.post("/api/v1/auth/login", json={"email": email, "password": password}, headers=preauth("127.0.11.7"))
    assert login.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 200
    assert client.post("/api/v1/workspaces", json={"name": "No CSRF"}, headers=preauth("127.0.11.8")).status_code == 403

    logout = client.post("/api/v1/auth/logout", json={}, headers=csrf(client, "127.0.11.9"))
    assert logout.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.post("/api/v1/auth/logout", json={}, headers=preauth("127.0.11.10")).status_code == 200
    with TestingSession() as db:
        account = db.query(AuthAccount).filter(AuthAccount.email == email).one()
        session = db.query(AuthSession).filter(AuthSession.account_id == account.id, AuthSession.revoked_at.is_not(None)).one()
        assert session.expires_at - session.created_at >= timedelta(days=6, hours=23)


def test_owner_member_and_cross_user_authorization(client):
    suffix = uuid.uuid4().hex
    owner_email = f"owner-{suffix}@example.com"
    owner = register_verify_login(client, owner_email, "127.0.12.1", "Owner")
    workspace = client.post("/api/v1/workspaces", json={"name": "Private Workspace"}, headers=csrf(client, "127.0.12.2"))
    assert workspace.status_code == 201, workspace.text
    project = client.post("/api/v1/projects", json={"name": "Private Project", "workspace_id": workspace.json()["id"]}, headers=csrf(client, "127.0.12.3"))
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    member_client = TestClient(app, base_url="http://testserver")
    member_client.verification_tokens = client.verification_tokens
    member_email = f"member-{suffix}@example.com"
    member = register_verify_login(member_client, member_email, "127.0.13.1", "Member")
    added = client.post(f"/api/v1/projects/{project_id}/members", json={"email": member_email}, headers=csrf(client, "127.0.12.4"))
    assert added.status_code == 201, added.text
    assert added.json()["user_id"] == member["id"]

    assert member_client.get(f"/api/v1/projects/{project_id}").status_code == 200
    assert member_client.get(f"/api/v1/projects/{project_id}/sprints").status_code == 200
    assert member_client.patch(f"/api/v1/projects/{project_id}", json={"name": "Denied"}, headers=csrf(member_client, "127.0.13.2")).status_code == 403
    assert member_client.post(f"/api/v1/projects/{project_id}/members", json={"email": owner_email}, headers=csrf(member_client, "127.0.13.3")).status_code == 403

    task = member_client.post("/api/v1/tasks", json={"project_id": project_id, "title": "Member task"}, headers=csrf(member_client, "127.0.13.4"))
    assert task.status_code == 201, task.text
    task_id = task.json()["id"]
    subtask = member_client.post(f"/api/v1/tasks/{task_id}/subtasks", json={"title": "Member checklist"}, headers=csrf(member_client, "127.0.13.41"))
    assert subtask.status_code == 201
    assert member_client.patch(f"/api/v1/tasks/{task_id}/subtasks/{subtask.json()['id']}", json={"is_completed": True}, headers=csrf(member_client, "127.0.13.42")).json()["is_completed"] is True
    assert member_client.patch(f"/api/v1/tasks/{task_id}/reorder", json={"status": "done", "position": 0}, headers=csrf(member_client, "127.0.13.43")).status_code == 200
    resource = member_client.post("/api/v1/resources", json={"project_id": project_id, "title": "Member resource", "url": "https://example.com", "resource_type": "Website", "keywords": []}, headers=csrf(member_client, "127.0.13.5"))
    assert resource.status_code == 201, resource.text
    resource_id = resource.json()["id"]
    assert member_client.patch(f"/api/v1/resources/{resource_id}", json={"description": "Updated by member", "keywords": ["technical"]}, headers=csrf(member_client, "127.0.13.51")).status_code == 200
    searched = member_client.get("/api/v1/resources", params={"project_id": project_id, "q": "technical"})
    assert searched.status_code == 200 and searched.json()["total"] == 1

    outsider_client = TestClient(app, base_url="http://testserver")
    outsider_client.verification_tokens = client.verification_tokens
    outsider_email = f"outsider-{suffix}@example.com"
    register_verify_login(outsider_client, outsider_email, "127.0.14.1", "Outsider")
    assert outsider_client.get(f"/api/v1/projects/{project_id}").status_code == 404
    assert outsider_client.get(f"/api/v1/tasks?project_id={project_id}").status_code == 404
    assert outsider_client.get(f"/api/v1/resources/{resource_id}").status_code == 404

    shared = member_client.get("/api/v1/projects?shared=true")
    assert shared.status_code == 200 and [item["id"] for item in shared.json()] == [project_id]
    own_scope = client.get(f"/api/v1/projects?workspace_id={workspace.json()['id']}")
    assert own_scope.status_code == 200 and own_scope.json()[0]["id"] == project_id
    assert member_client.delete(f"/api/v1/tasks/{task_id}/subtasks/{subtask.json()['id']}", headers=csrf(member_client, "127.0.13.52")).status_code == 200
    assert member_client.delete(f"/api/v1/resources/{resource_id}", headers=csrf(member_client, "127.0.13.53")).status_code == 200
    assert member_client.delete(f"/api/v1/tasks/{task_id}", headers=csrf(member_client, "127.0.13.54")).status_code == 200
    assert owner["id"] != member["id"]


def test_unassigned_legacy_project_is_not_exposed(client):
    suffix = uuid.uuid4().hex
    register_verify_login(client, f"legacy-reader-{suffix}@example.com", "127.0.15.1")
    with TestingSession() as db:
        legacy = Project(key=f"L{suffix[:7]}".upper(), name="Legacy unassigned", workspace_id=None)
        db.add(legacy)
        db.commit()
        legacy_id = legacy.id
    assert client.get("/api/v1/projects?unassigned=true").json() == []
    assert client.get(f"/api/v1/projects/{legacy_id}").status_code == 404


def test_session_persists_across_client_and_inactive_user_is_denied(client):
    suffix = uuid.uuid4().hex
    email = f"session-{suffix}@example.com"
    user = register_verify_login(client, email, "127.0.16.1")
    restored = TestClient(app, base_url="http://testserver")
    for cookie in client.cookies.jar:
        restored.cookies.set(cookie.name, cookie.value)
    assert restored.get("/api/v1/auth/me").status_code == 200
    with TestingSession() as db:
        db.query(User).filter(User.id == user["id"]).update({User.is_active: False})
        db.commit()
    assert restored.get("/api/v1/auth/me").status_code == 401


def test_preauth_origin_and_resend_are_safe(client):
    suffix = uuid.uuid4().hex
    email = f"pending-{suffix}@example.com"
    payload = {"display_name": "Pending", "email": email, "password": "valid password 12345"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 415
    assert client.post("/api/v1/auth/register", json=payload, headers=preauth("127.0.17.1")).status_code == 201
    known = client.post("/api/v1/auth/resend-verification", json={"email": email}, headers=preauth("127.0.17.2"))
    unknown = client.post("/api/v1/auth/resend-verification", json={"email": f"unknown-{suffix}@example.com"}, headers=preauth("127.0.17.3"))
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()


def test_login_rate_limit_is_persisted_in_postgres(client):
    suffix = uuid.uuid4().hex
    payload = {"email": f"missing-{suffix}@example.com", "password": "invalid password"}
    headers = preauth("127.0.18.1")
    assert [client.post("/api/v1/auth/login", json=payload, headers=headers).status_code for _ in range(8)] == [401] * 8
    assert client.post("/api/v1/auth/login", json=payload, headers=headers).status_code == 429


def test_missing_schema_is_reported_before_registration(client, monkeypatch):
    from app.core import auth as auth_core
    monkeypatch.setattr(auth_core, "authentication_schema_ready", lambda db: False)
    monkeypatch.setattr(auth_api, "authentication_schema_ready", lambda db: False)
    status = client.get("/api/v1/auth/status")
    assert status.status_code == 200
    assert status.json()["ready"] is False
    assert status.json()["registration_available"] is False
    response = client.post("/api/v1/auth/register", json={"display_name": "Blocked", "email": f"blocked-{uuid.uuid4().hex}@example.com", "password": "valid password 12345"}, headers=preauth("127.0.19.1"))
    assert response.status_code == 503
    assert "Authentication" in response.json()["detail"]


def test_missing_smtp_does_not_create_dead_end_account(client, monkeypatch):
    monkeypatch.setattr(auth_api, "verification_email_configured", lambda: False)
    email = f"no-mail-{uuid.uuid4().hex}@example.com"
    assert client.get("/api/v1/auth/status").json() == {"ready": True, "registration_available": False, "message": "Registration is temporarily unavailable. Please contact the administrator."}
    response = client.post("/api/v1/auth/register", json={"display_name": "No email", "email": email, "password": "valid password 12345"}, headers=preauth("127.0.19.2"))
    assert response.status_code == 503
    with TestingSession() as db:
        assert db.query(AuthAccount).filter(AuthAccount.email == email).count() == 0
        assert db.query(User).filter(User.email == email).count() == 0


def test_legacy_activation_login_opens_original_workspace(client):
    from app.core.auth_recovery import prepare_legacy_account
    from app.models.workspace import Workspace
    from app.models.task import Task
    from app.models.project_resource import ProjectResource
    suffix = uuid.uuid4().hex
    email = f"restored-{suffix}@example.test"
    password = "restore existing account 12345"
    with TestingSession() as db, db.begin():
        user = User(display_name="Original Owner", default_avatar_key="owl", is_active=True)
        db.add(user)
        db.flush()
        workspace = Workspace(name="Original Workspace", owner_user_id=user.id, workspace_type="personal")
        db.add(workspace)
        db.flush()
        project = Project(key=f"V{suffix[:8]}".upper(), name="Original Project", workspace_id=workspace.id)
        db.add(project)
        db.flush()
        task = Task(project_id=project.id, task_key=f"{project.key}-1", title="Original task", category="Task", status="todo", priority="medium", position=0, weight=1)
        resource = ProjectResource(project_id=project.id, title="Original resource", url="https://example.test", resource_type="Website", keywords=["original"])
        db.add_all([task, resource])
        db.flush()
        user_id, workspace_id, project_id, task_id, resource_id = user.id, workspace.id, project.id, task.id, resource.id
        token = prepare_legacy_account(db, user_id, workspace_id, email, password)

    assert client.post("/api/v1/auth/login", json={"email": email, "password": password}, headers=preauth("127.0.20.1")).status_code == 403
    assert client.post("/api/v1/auth/verify-email", json={"token": token}, headers=preauth("127.0.20.2")).status_code == 200
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password}, headers=preauth("127.0.20.3"))
    assert login.status_code == 200 and login.json()["user"]["id"] == user_id
    assert client.get("/api/v1/workspaces").json()[0]["id"] == workspace_id
    assert client.get("/api/v1/projects", params={"workspace_id": workspace_id}).json()[0]["id"] == project_id
    assert client.get("/api/v1/tasks", params={"project_id": project_id}).json()[0]["id"] == task_id
    assert client.get("/api/v1/resources", params={"project_id": project_id}).json()["items"][0]["id"] == resource_id


def test_concurrent_duplicate_registration_has_one_winner(client, monkeypatch):
    suffix = uuid.uuid4().hex
    email = f"race-{suffix}@example.com"
    password = "valid password 12345"
    monkeypatch.setattr(auth_api, "send_verification_email", lambda *_: "sent")

    def attempt(index: int) -> int:
        with TestClient(app, base_url="http://testserver") as race_client:
            response = race_client.post("/api/v1/auth/register", json={"display_name": f"Race {index}", "email": email, "password": password}, headers=preauth(f"127.1.0.{index + 1}"))
            return response.status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = sorted(executor.map(attempt, range(2)))
    assert statuses == [201, 409]
    with TestingSession() as db:
        assert db.query(AuthAccount).filter(AuthAccount.email == email).count() == 1
