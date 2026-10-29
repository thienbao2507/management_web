"""Run from backend: python -m scripts.auth_recovery --help. Dry-run is the default."""
import argparse
import getpass
import json
from urllib.parse import urlparse

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.auth import send_verification_email, verification_email_configured
from app.core.auth_recovery import inspect_legacy_mapping, prepare_legacy_account
from app.core.config import settings


def main() -> int:
    parser = argparse.ArgumentParser(description="Activate an explicitly approved legacy User without moving or deleting Workspace data.")
    parser.add_argument("--legacy-user-id", required=True)
    parser.add_argument("--workspace-id", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--apply", action="store_true", help="Write a pending account after interactive confirmation/password entry. Requires prior production approval.")
    args = parser.parse_args()
    url = settings.DATABASE_URL_UNPOOLED or settings.DATABASE_URL
    host = make_url(url).host or ""
    if args.apply and host.endswith(".neon.tech") and "-pooler" in host:
        print("Use the approved direct DATABASE_URL_UNPOOLED for administrator activation.")
        return 1
    engine = create_engine(url, connect_args={"connect_timeout": 10}, hide_parameters=True)
    try:
        with Session(engine) as db, db.begin():
            db.execute(text("SET TRANSACTION READ ONLY"))
            result = inspect_legacy_mapping(db, args.legacy_user_id, args.workspace_id, args.email)
            print(json.dumps(result))
        if not args.apply:
            print("Dry-run only. No account, ownership or data was changed.")
            return 0
        if not verification_email_configured():
            print("Configure SMTP and the public HTTPS APP_BASE_URL before activation. No account was created.")
            return 1
        app_url = urlparse(settings.APP_BASE_URL)
        if host.endswith(".neon.tech") and (app_url.scheme != "https" or not app_url.hostname or app_url.hostname in {"localhost", "127.0.0.1"}):
            print("Set APP_BASE_URL to the public HTTPS application URL before activation. No account was created.")
            return 1
        if input("Confirm the approved legacy User ID: ").strip() != args.legacy_user_id:
            print("Cancelled. No account was created.")
            return 1
        password = getpass.getpass("Choose a password (15-128 characters, not stored in command history): ")
        if password != getpass.getpass("Repeat password: "):
            print("Passwords did not match. No account was created.")
            return 1
        with Session(engine) as db, db.begin():
            token = prepare_legacy_account(db, args.legacy_user_id, args.workspace_id, args.email, password)
        delivery = send_verification_email(args.email.strip().lower(), token)
        print("Pending account created on the existing User ID; all Workspace data preserved.")
        print("Verification email sent. Open its link, verify, then sign in." if delivery == "sent" else "Email could not be delivered. The pending account is preserved; use Verify email / Resend after fixing email delivery.")
        return 0 if delivery == "sent" else 2
    except (ValueError, SQLAlchemyError):
        # Never echo SQLAlchemy exceptions, passwords, tokens or connection URLs.
        print("Activation blocked: check migration, exact mapping, account/email conflicts and database access. No automatic merge was attempted.")
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
