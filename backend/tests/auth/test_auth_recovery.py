import os
import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

TEST_URL = os.getenv("TEST_AUTH_DATABASE_URL", "")
parsed = make_url(TEST_URL) if TEST_URL else None
if not parsed or parsed.host not in {"127.0.0.1", "localhost"} or not (parsed.database or "").startswith("management_auth001_test_"):
    pytest.skip("Isolated local auth database is required", allow_module_level=True)

from app.core.auth import token_hash, verify_password  # noqa: E402
from app.core.auth_recovery import inspect_legacy_mapping, prepare_legacy_account  # noqa: E402
from app.models.auth import AuthAccount, AuthEmailVerification  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.workspace import Workspace  # noqa: E402
from app.models.project import Project  # noqa: E402


def test_admin_activation_preserves_existing_user_and_workspace_ids():
    engine = create_engine(TEST_URL)
    try:
        suffix = uuid.uuid4().hex
        email = f"legacy-{suffix}@example.test"
        password = "local activation password 123"
        with Session(engine) as db, db.begin():
            user = User(display_name="Legacy", default_avatar_key="owl", is_active=True)
            db.add(user)
            db.flush()
            workspace = Workspace(owner_user_id=user.id, name="Existing Workspace", workspace_type="personal")
            db.add(workspace)
            db.flush()
            project = Project(key=f"R{suffix[:8]}".upper(), name="Existing Project", workspace_id=workspace.id)
            db.add(project)
            db.flush()
            user_id, workspace_id, project_id = user.id, workspace.id, project.id

        with Session(engine) as db, db.begin():
            result = inspect_legacy_mapping(db, user_id, workspace_id, email)
            assert result["preserved_records"]["projects"] == 1
            assert db.query(AuthAccount).filter_by(user_id=user_id).count() == 0
            assert db.get(User, user_id).email is None
            with pytest.raises(ValueError):
                inspect_legacy_mapping(db, user_id, "wrong-workspace", email)

        with Session(engine) as db, db.begin():
            raw_token = prepare_legacy_account(db, user_id, workspace_id, email, password)

        with Session(engine) as db, db.begin():
            account = db.query(AuthAccount).filter_by(user_id=user_id).one()
            assert account.email_verified_at is None
            assert verify_password(account.password_hash, password)
            assert db.query(AuthEmailVerification).filter_by(account_id=account.id, token_hash=token_hash(raw_token)).count() == 1
            assert db.get(Workspace, workspace_id).owner_user_id == user_id
            assert db.get(Project, project_id).workspace_id == workspace_id
            with pytest.raises(ValueError):
                prepare_legacy_account(db, user_id, workspace_id, email, password)
    finally:
        engine.dispose()
