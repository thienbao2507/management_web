import os
import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


BACKEND = Path(__file__).resolve().parents[2]


def test_auth_migration_preserves_legacy_identity_and_project_data():
    supplied = os.getenv("TEST_AUTH_DATABASE_URL", "")
    parsed = make_url(supplied) if supplied else None
    if not parsed or parsed.host not in {"127.0.0.1", "localhost"}:
        pytest.skip("Explicit local PostgreSQL is required")
    assert (parsed.database or "").startswith("management_auth001_test_")

    database_name = f"management_auth001_migration_{uuid.uuid4().hex[:10]}"
    admin = create_engine(parsed.set(database="postgres"), isolation_level="AUTOCOMMIT")
    test_url = parsed.set(database=database_name).render_as_string(hide_password=False)
    engine = None
    try:
        with admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{database_name}"'))
        engine = create_engine(test_url)

        def migrate(revision: str, *, downgrade: bool = False):
            config = Config(str(BACKEND / "alembic.ini"))
            with engine.begin() as connection:
                config.attributes["connection"] = connection
                (command.downgrade if downgrade else command.upgrade)(config, revision)

        migrate("b41f01d5e001")
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO users (id,display_name,default_avatar_key,is_active,created_at,updated_at) VALUES ('legacy-user','Legacy User','owl',true,now(),now())"))
            connection.execute(text("INSERT INTO workspaces (id,owner_user_id,name,workspace_type,created_at,updated_at) VALUES ('legacy-workspace','legacy-user','Legacy Workspace','personal',now(),now())"))
            connection.execute(text("INSERT INTO projects (id,workspace_id,key,name,status,priority,is_archived,created_at,updated_at) VALUES ('legacy-project','legacy-workspace','LEG','Legacy Project','active','medium',false,now(),now())"))
            connection.execute(text("INSERT INTO tasks (id,project_id,task_key,title,category,status,priority,position,weight,is_blocked,created_at,updated_at) VALUES ('legacy-task','legacy-project','LEG-1','Legacy Task','Task','todo','medium',0,1,false,now(),now())"))
            before = connection.execute(text("SELECT u.id,w.id,p.id,t.id,p.workspace_id,t.project_id FROM users u JOIN workspaces w ON w.owner_user_id=u.id JOIN projects p ON p.workspace_id=w.id JOIN tasks t ON t.project_id=p.id")).one()

        migrate("c51f01d5e002")
        with engine.connect() as connection:
            after = connection.execute(text("SELECT u.id,w.id,p.id,t.id,p.workspace_id,t.project_id FROM users u JOIN workspaces w ON w.owner_user_id=u.id JOIN projects p ON p.workspace_id=w.id JOIN tasks t ON t.project_id=p.id")).one()
            assert after == before
            assert connection.execute(text("SELECT count(*) FROM auth_accounts")).scalar_one() == 0
            assert connection.execute(text("SELECT count(*) FROM auth_sessions")).scalar_one() == 0

        migrate("b41f01d5e001", downgrade=True)
        with engine.connect() as connection:
            assert connection.execute(text("SELECT to_regclass('public.auth_accounts')")).scalar() is None
            assert connection.execute(text("SELECT count(*) FROM tasks WHERE id='legacy-task'")).scalar_one() == 1
    finally:
        if engine:
            engine.dispose()
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{database_name}"'))
        admin.dispose()
