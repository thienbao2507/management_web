# Vercel Services deployment

This repository deploys the Vite frontend and FastAPI backend as two services in the existing `management-web` Vercel project. `render.yaml` is retained for history but is not used by this deployment.

## Dashboard settings

In **Project Settings → Build and Deployment**:

- Clear **Root Directory** so the repository root containing `vercel.json` is used. Do not leave it set to `frontend`.
- Set the project-level **Framework Preset** to `Other` if Vercel requires a value.
- Clear project-level overrides for **Install Command**, **Build Command**, and **Output Directory**. These settings are owned by the individual services in `vercel.json`.
- Do not add a backend start command. Vercel loads the FastAPI `app` directly through its Python runtime; it does not run a standalone Uvicorn server.

The frontend service runs `npm run build` from `frontend/` and publishes `frontend/dist`. The backend service loads `backend/app/main.py` as `app.main:app`, installs `backend/requirements.txt`, and uses Python 3.12 from `backend/.python-version`.

## Environment variables

Add `DATABASE_URL` in **Project Settings → Environment Variables** as a Sensitive value. Use the existing pooled Neon application URL. Never prefix it with `VITE_`, write it into source, or expose it through frontend code.

Configure environments deliberately:

- **Preview:** add the specific Neon URL approved for preview deployments.
- **Production:** add the existing production Neon URL only to Production.
- Do not copy a secret from Preview to Production, or the reverse, without reviewing the target branch/database.

Services share project environment configuration, but Vite does not expose an unprefixed `DATABASE_URL` in the browser bundle. The browser continues to call relative `/api/v1` URLs on the deployment domain.

## Preview verification

1. Commit the source changes on a non-production branch and push it after review.
2. Let Vercel create a Preview Deployment. Do not promote it yet.
3. Run read-only GET checks against the preview domain:
   - `/` returns the frontend HTML.
   - A built `/assets/...` URL returns a static asset.
   - `/health` returns FastAPI JSON. This does not prove database access.
   - `/api/v1/openapi.json` returns OpenAPI JSON.
   - `/api/v1/auth/status` reports `ready: true` after the approved authentication migration. It reports registration availability separately.
   - `/api/v1/auth/me`, `/api/v1/users` and `/api/v1/projects` return JSON 401 while signed out. After login, verify the current account and its scoped data.
   - `/api/v1/route-that-does-not-exist` returns an API 404 response, not `index.html`.
4. If a data API returns a schema-related 503, stop and review the missing migration separately. Do not run Alembic from a Vercel build or deployment.

## Production rollout

After the preview checks pass, merge or deploy the reviewed commit to the production branch. Re-run the same GET checks on `https://management-web-beta.vercel.app`. Do not create test users or other production records as part of deployment verification.

## Authentication rollout and existing Workspace recovery

Deploying source does not apply database migrations. Authentication needs revision `c51f01d5e002` (parent `b41f01d5e001`). The migration adds `auth_accounts`, `auth_sessions`, `auth_email_verifications` and `auth_rate_limits`; it does not populate accounts or change existing Workspace ownership. Never add migrations to Vercel builds or API startup.

Follow [`backend/AUTH_SCHEMA_MIGRATION.md`](backend/AUTH_SCHEMA_MIGRATION.md) for the guarded audit, full pending-chain review, isolated rehearsal, approval request, recovery plan, and post-migration verification. The complete current chain is `123263086b0a -> 9b8a6d3f4e21 -> a31f01c4d001 -> a31f02c4d002 -> b41f01d5e001 -> c51f01d5e002`; select the pending suffix only after auditing the target.

1. Audit the actual target database read-only and verify its current revision and existing record counts. Verify Vercel Production uses that same database/branch. Review the existing additive migration and rehearse it on an isolated database.
2. Obtain explicit production migration approval. Use the approved direct `DATABASE_URL_UNPOOLED`, not the pooled runtime URL. From `backend/`, apply only the reviewed target with `python -m alembic upgrade c51f01d5e002`. Do not use `stamp`, recreate schemas, reset data or downgrade a live database to fix this issue. Verify the new revision and unchanged existing record counts.
3. Configure backend environment variables for the correct Vercel environment, then redeploy the approved source:
   - `APP_BASE_URL=https://management-web-beta.vercel.app` for Production; use the matching public URL for Preview.
   - `AUTH_COOKIE_SECURE=true` for HTTPS deployment; keep default cookie names `mw_session` and `mw_csrf` (frontend expects `mw_csrf`).
   - SMTP provider's `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_STARTTLS`. Store credentials as secrets. The existing sender supports STARTTLS SMTP (normally port 587); use settings supplied by your provider. Do not paste passwords or verification tokens into source, Git or chat.
4. Verify `/api/v1/auth/status` returns `ready: true` and `registration_available: true`. SMTP presence alone does not prove delivery; use an approved account to verify actual email delivery. Sign-in is at `/#/login`, registration at `/#/register` and verification/resend at `/#/verify`.

For a user who already owns Workspace data but has no auth account, prefer activating that existing User ID rather than registering a separate identity. Confirm the exact User ID, owned Workspace ID and intended email with the owner first. No public API can claim existing profiles. No automatic matching by display name or email is performed.

From `backend/`, using the approved target database environment:

```text
python -m scripts.auth_recovery --legacy-user-id USER_ID --workspace-id WORKSPACE_ID --email OWNER_EMAIL
```

The default is a read-only mapping check, including preserved record counts. It works before migration to inspect the proposed mapping, but account activation requires exactly `c51f01d5e002` and configured email delivery.

After explicit mapping/production activation approval, the owner runs the same command with `--apply`. It prompts for the exact User ID and a new password twice using hidden input; never put the password in arguments or send it to the agent. This creates a pending auth account on the original User ID and sends the ordinary verification email. The owner follows the email link, verifies, then signs in with the chosen password. All existing ownership IDs are retained.

If email sending fails, the pending account remains and Verify email / Resend can retry delivery. Do not rerun activation to reset credentials. If a separate account already uses the email or User ID, the tool refuses to merge; audit and approve a separate mapping plan. Do not transfer the old Workspace to the first registrant or expose unassigned data as a workaround.

References:

- https://vercel.com/docs/services
- https://vercel.com/docs/services/routing
- https://vercel.com/docs/frameworks/backend/fastapi
- https://vercel.com/docs/functions/runtimes/python
