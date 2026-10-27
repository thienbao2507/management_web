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
   - `/api/v1/users` and `/api/v1/projects` return FastAPI JSON and confirm the configured database/schema is reachable.
   - `/api/v1/route-that-does-not-exist` returns an API 404 response, not `index.html`.
4. If a data API returns a schema-related 503, stop and review the missing migration separately. Do not run Alembic from a Vercel build or deployment.

## Production rollout

After the preview checks pass, merge or deploy the reviewed commit to the production branch. Re-run the same GET checks on `https://management-web-beta.vercel.app`. Do not create test users or other production records as part of deployment verification.

References:

- https://vercel.com/docs/services
- https://vercel.com/docs/services/routing
- https://vercel.com/docs/frameworks/backend/fastapi
- https://vercel.com/docs/functions/runtimes/python
