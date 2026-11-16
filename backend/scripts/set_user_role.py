"""Set a user's role by email. Dry-run is the default."""

import argparse

from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError

from app.core.auth import utcnow
from app.core.database import SessionLocal
from app.models.user import USER_ROLES, User


def main() -> int:
    parser = argparse.ArgumentParser(description="Set a Management Web user role by email.")
    parser.add_argument("--email", required=True, help="Account email to look up.")
    parser.add_argument("--role", required=True, choices=USER_ROLES)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist the requested role. Without this flag, no data is changed.",
    )
    args = parser.parse_args()
    normalized_email = args.email.strip().lower()

    try:
        with SessionLocal() as db:
            user = (
                db.query(User)
                .filter(func.lower(User.email) == normalized_email)
                .first()
            )
            if not user:
                print("User not found.")
                return 1

            print(f"Display name: {user.display_name}")
            print(f"Current role: {user.role}")
            print(f"New role: {args.role}")
            if not args.apply:
                print("Dry-run only. No user role was changed.")
                return 0

            user.role = args.role
            user.updated_at = utcnow()
            db.commit()
            print("Role updated.")
            return 0
    except SQLAlchemyError:
        print("Role update failed. Check the user schema and database access.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
