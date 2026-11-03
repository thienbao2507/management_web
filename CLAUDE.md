# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Project management / Kanban web app ("Project Command Center"). Two independent apps in one repo:

- `backend/` — FastAPI + SQLAlchemy 2 + Alembic on Neon PostgreSQL (Python 3.12 per `backend/.python-version`; local scripts use conda env `env_310`).
- `frontend/` — React 19 + TypeScript + Vite + Tailwind 3 + Radix UI, lint via oxlint.

## Commands

Backend (run from `backend/`; requires `DATABASE_URL` in env or `backend/.env` — `app/core/config.py` raises at import otherwise):

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000   # or start-backend.bat
python -m pytest tests/auth                                              # tracked test suite
python -m pytest tests/auth/test_auth_flow.py::test_name                 # single test
python -B -m alembic heads ; python -B -m alembic history                # inspect migration chain
python -m scripts.auth_recovery --help                                    # admin legacy-account activation (dry-run default)
```

Frontend (from repo root the root `package.json` proxies to `frontend/`):

```powershell
npm run dev                       # Vite on port 6006 (strictPort), proxies /api -> 127.0.0.1:8000 (override with API_PROXY_TARGET)
npm run build                     # tsc -b && vite build
npm --prefix frontend run lint    # oxlint
```

`start-all.bat` launches both. API docs: `http://127.0.0.1:8000/api/v1/docs`.

## Testing constraints

- Integration tests never fall back to the real DB. They `pytest.skip` unless pointed at an isolated **local** Postgres: `TEST_AUTH_DATABASE_URL` must be host `localhost`/`127.0.0.1` with a database name starting `management_auth001_test_`; resources tests use `TEST_RESOURCES_DATABASE_URL`. Tests override `get_db` and set `AUTH_COOKIE_SECURE=false`.
- Only `backend/tests/auth/` is git-tracked; other test dirs (`tests/phase3`, `tests/workspaces`, browser/screenshot scripts) are gitignored local QA tooling. `tests/test_api.py` lifecycle test is intentionally skipped (legacy anonymous contract).

## Architecture

Backend layering: `app/api/v1/*` routers → `app/schemas` (Pydantic) / `app/models` (SQLAlchemy, `Base` from `app/core/database.py`). All routers mount under `/api/v1`; every router except `auth` has `dependencies=[Depends(require_authenticated_request)]`.

- **Auth** (`app/core/auth.py`, `api/v1/auth.py`): cookie sessions (`mw_session`) + double-submit CSRF (`mw_csrf` cookie echoed as `X-CSRF-Token` on non-GET), Argon2 passwords, DB-backed rate limiting, origin checks. Email verification is optional — SMTP is currently off; `AUTH_REQUIRE_EMAIL_VERIFICATION=auto` follows whether SMTP is configured.
- **Authorization** (`app/core/authorization.py`): access is derived from data, not roles — a user can access a project if they own its personal `Workspace` (`owner_user_id`) or have a `ProjectMembership`. Use `accessible_project_query` / `require_project_access(owner_required=...)` / `require_workspace_owner`; missing access returns 404, not 403 (403 only for owner-required actions).
- **Schema-not-ready handling** (`app/main.py`): a `ProgrammingError` handler maps missing tables/columns (pgcodes 42P01/42703) for auth, workspaces, users, resources to 503 messages. This exists because production schema can lag behind source.
- Dates use the UTC+7 display timezone (`APP_TIMEZONE = Asia/Ho_Chi_Minh`).

Frontend:

- No router library; views are hash-based (`viewPaths` in `src/App.tsx`). `App.tsx` holds most page state (projects, selected project, sprint scope, tasks).
- Provider tree: `ThemeProvider` → `UserProvider` (session/current user, normalized user cache by id) → `WorkspaceProvider` → `AppContent`. Project-level data via `context/useProjectWorkspace.ts`.
- All HTTP goes through `src/services/api.ts` (types mirror backend schemas; relative `/api/v1` base, `credentials: same-origin`, attaches CSRF header automatically). Add new endpoints there.
- `@/` alias → `frontend/src`. Reusable primitives live in `components/ui/`.

## Database & migrations — strict rules

- Alembic `env.py` uses `DATABASE_URL_UNPOOLED` (direct) and refuses a Neon `-pooler` host for migrations. The app uses pooled `DATABASE_URL`.
- Never run Alembic or ad-hoc DDL from app startup, builds, or request handlers. Migrations against Neon/production require explicit approval; follow `backend/AUTH_SCHEMA_MIGRATION.md` (read-only audit first, never print DB URLs). New revisions must keep a single linear head.
- `.neon` / `neon.ts` link the Neon project; don't modify them or `.env`.

## Deployment

Vercel Services (`vercel.json`): `frontend/` (Vite → `dist`) and `backend/` (`app.main:app` loaded directly, no uvicorn); `/api/*` and `/health` rewrite to backend. `DATABASE_URL` is a server-only Sensitive env var — never prefix with `VITE_`. `render.yaml` is legacy, unused. Details: `VERCEL_SERVICES_DEPLOYMENT.md`.

## Reference docs

`PHASE3_HANDOVER.md` (users/identity/workspace phase, Vietnamese) and `PROJECT_RESOURCES_HANDOVER.md` record feature contracts and what has/hasn't been migrated in production.
