import os
import uuid
from contextlib import contextmanager
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

BACKEND = Path(__file__).resolve().parents[2]
TARGET_REVISION = "c51f01d5e002"
START_REVISIONS = ("123263086b0a", "9b8a6d3f4e21", "a31f01c4d001", "a31f02c4d002", "b41f01d5e001")


def _local_test_url():
    supplied = os.getenv("TEST_AUTH_DATABASE_URL", "")
    parsed = make_url(supplied) if supplied else None
    if not parsed or parsed.host not in {"127.0.0.1", "localhost"}:
        pytest.skip("Explicit local PostgreSQL is required")
    assert (parsed.database or "").startswith("management_auth001_test_")
    return parsed


@contextmanager
def _database():
    parsed = _local_test_url()
    name = f"management_auth001_migration_{uuid.uuid4().hex[:10]}"
    admin = create_engine(parsed.set(database="postgres"), isolation_level="AUTOCOMMIT")
    engine = None
    try:
        with admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{name}"'))
        engine = create_engine(parsed.set(database=name).render_as_string(hide_password=False))
        yield engine
    finally:
        if engine:
            engine.dispose()
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{name}"'))
        admin.dispose()


def _migrate(engine, revision):
    config = Config(str(BACKEND / "alembic.ini"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, revision)


def _seed(engine, revision):
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO projects (id,key,name,status,priority,is_archived,created_at,updated_at) VALUES ('legacy-project','LEG','Legacy Project','active','medium',false,now(),now())"))
        connection.execute(text("INSERT INTO sprints (id,project_id,name,status,created_at) VALUES ('legacy-sprint','legacy-project','Legacy Sprint','active',now())"))
        connection.execute(text("INSERT INTO tasks (id,project_id,sprint_id,task_key,title,category,status,priority,position,weight,is_blocked,created_at,updated_at) VALUES ('legacy-task','legacy-project','legacy-sprint','LEG-1','Legacy Task','Task','todo','medium',0,1,false,now(),now())"))
        connection.execute(text("INSERT INTO subtasks (id,task_id,title,is_completed,position,created_at) VALUES ('legacy-subtask','legacy-task','Legacy Subtask',false,0,now())"))
        if revision != "123263086b0a":
            connection.execute(text("INSERT INTO project_resources (id,project_id,title,url,resource_type,keywords,created_at,updated_at) VALUES ('legacy-resource','legacy-project','Legacy Resource','https://example.test','Website',ARRAY['legacy'],now(),now())"))
        if revision in {"a31f01c4d001", "a31f02c4d002", "b41f01d5e001"}:
            connection.execute(text("INSERT INTO users (id,display_name,email,default_avatar_key,is_active,created_at,updated_at) VALUES ('legacy-user','Legacy User','legacy@example.test','owl',true,now(),now())"))
        if revision in {"a31f02c4d002", "b41f01d5e001"}:
            connection.execute(text("INSERT INTO project_memberships (project_id,user_id) VALUES ('legacy-project','legacy-user')"))
            connection.execute(text("UPDATE tasks SET assignee_id='legacy-user' WHERE id='legacy-task'"))
        if revision == "b41f01d5e001":
            connection.execute(text("INSERT INTO workspaces (id,owner_user_id,name,workspace_type,created_at,updated_at) VALUES ('legacy-workspace','legacy-user','Legacy Workspace','personal',now(),now())"))
            connection.execute(text("UPDATE projects SET workspace_id='legacy-workspace' WHERE id='legacy-project'"))


def _snapshot(engine):
    tables = set(inspect(engine).get_table_names())
    columns = {
        "projects": "id,key,name,status,priority" + (",workspace_id" if "workspaces" in tables else ""),
        "sprints": "id,project_id,name,status",
        "tasks": "id,project_id,sprint_id,task_key,title,status" + (",assignee_id" if "project_memberships" in tables else ""),
        "subtasks": "id,task_id,title,is_completed,position",
    }
    optional = {
        "project_resources": "id,project_id,title,url,resource_type,keywords",
        "users": "id,display_name,email,default_avatar_key,is_active",
        "project_memberships": "project_id,user_id",
        "workspaces": "id,owner_user_id,name,workspace_type",
    }
    columns.update({table: value for table, value in optional.items() if table in tables})
    with engine.connect() as connection:
        return {table: connection.execute(text(f"SELECT {value} FROM {table} ORDER BY 1")).all() for table, value in columns.items()}


@pytest.mark.parametrize("start_revision", START_REVISIONS)
def test_supported_revision_upgrades_preserve_legacy_data(start_revision):
    with _database() as engine:
        _migrate(engine, start_revision)
        _seed(engine, start_revision)
        before = _snapshot(engine)
        _migrate(engine, TARGET_REVISION)
        after = _snapshot(engine)
        assert after == before
        assert {"auth_accounts", "auth_sessions", "auth_email_verifications", "auth_rate_limits"} <= set(inspect(engine).get_table_names())
        with engine.connect() as connection:
            assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == TARGET_REVISION
            assert connection.execute(text("SELECT count(*) FROM auth_accounts")).scalar_one() == 0
            assert connection.execute(text("SELECT count(*) FROM auth_sessions")).scalar_one() == 0
            if start_revision != "b41f01d5e001":
                assert connection.execute(text("SELECT workspace_id FROM projects WHERE id='legacy-project'")).scalar_one() is None
            if start_revision not in {"a31f02c4d002", "b41f01d5e001"}:
                assert connection.execute(text("SELECT assignee_id FROM tasks WHERE id='legacy-task'")).scalar_one() is None
        _migrate(engine, TARGET_REVISION)
        assert _snapshot(engine) == after


def test_registration_is_blocked_before_upgrade_then_verify_and_login(monkeypatch):
    with _database() as engine:
        _migrate(engine, "b41f01d5e001")
        from app.api.v1 import auth as auth_api
        from app.core.database import get_db
        from app.main import app

        testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
        tokens = {}

        def override_db():
            with testing_session() as db:
                yield db

        def capture(email, token):
            tokens[email] = token
            return "sent"

        monkeypatch.setattr(auth_api, "send_verification_email", capture)
        monkeypatch.setattr(auth_api, "verification_email_configured", lambda: True)
        app.dependency_overrides[get_db] = override_db
        email = f"migration-{uuid.uuid4().hex}@example.test"
        headers = {"Origin": "http://testserver", "X-Management-Web-Request": "1", "X-Forwarded-For": "127.0.21.1"}
        payload = {"display_name": "Migration User", "email": email, "password": "valid password 12345"}
        try:
            with TestClient(app, base_url="http://testserver") as client:
                assert client.post("/api/v1/auth/register", json=payload, headers=headers).status_code == 503
            _migrate(engine, TARGET_REVISION)
            with TestClient(app, base_url="http://testserver") as client:
                registered = client.post("/api/v1/auth/register", json=payload, headers=headers)
                assert registered.status_code == 201
                assert "password" not in registered.text.lower() and "token" not in registered.text.lower()
                verified = client.post("/api/v1/auth/verify-email", json={"token": tokens[email]}, headers={**headers, "X-Forwarded-For": "127.0.21.2"})
                assert verified.status_code == 200
                logged_in = client.post("/api/v1/auth/login", json={"email": email, "password": payload["password"]}, headers={**headers, "X-Forwarded-For": "127.0.21.3"})
                assert logged_in.status_code == 200
                assert "password_hash" not in logged_in.text and "token" not in logged_in.json()
        finally:
            app.dependency_overrides.pop(get_db, None)
