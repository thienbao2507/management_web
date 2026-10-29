# Authentication schema migration runbook

This runbook audits and rehearses the existing Alembic chain before an explicitly approved database change. It does not authorize a migration. Builds, application startup, and request handlers must never run Alembic or ad-hoc DDL.

Target revision: `c51f01d5e002`. Verified chain:

`base -> 123263086b0a -> 9b8a6d3f4e21 -> a31f01c4d001 -> a31f02c4d002 -> b41f01d5e001 -> c51f01d5e002`

## 1. Identify and guard the target

Record non-secret project, branch, endpoint, database, and environment identifiers. Confirm that the application's pooled `DATABASE_URL` and the operator's direct `DATABASE_URL_UNPOOLED` resolve to the same intended branch and database. The migration URL must be direct: a Neon hostname containing `-pooler` is not acceptable.

From `backend/`, review the complete pending chain and record checksums before approval:

```powershell
python -B -m alembic heads
python -B -m alembic history
Get-FileHash -Algorithm SHA256 alembic/versions/*.py
```

Do not print either database URL. Connect with the approved direct URL and run the audit in a read-only transaction with short timeouts:

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '5s';
SELECT current_database(), current_user, current_schema(), current_setting('search_path');
SELECT to_regclass('public.alembic_version') AS alembic_version_table;
-- Run only when the preceding value is not null:
SELECT version_num FROM public.alembic_version;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('projects','sprints','tasks','subtasks','project_resources',
                     'users','project_memberships','workspaces','auth_accounts',
                     'auth_sessions','auth_email_verifications','auth_rate_limits')
ORDER BY table_name;
SELECT table_name, column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users','tasks','projects','workspaces','auth_accounts',
                     'auth_sessions','auth_email_verifications','auth_rate_limits')
ORDER BY table_name, ordinal_position;
ROLLBACK;
```

Stop if the version table is absent, the revision is unknown, objects conflict with the recorded revision, the final revision lacks required objects, the effective schema/search path is unexpected, the runtime and direct endpoints differ, or the chain has gained a revision. Do not use `stamp`, `create_all`, guessed SQL, reset, or downgrade to conceal drift. A clean database bootstrap is a separate decision.

## 2. Capture preservation evidence

In one read-only, consistent transaction, record counts only for tables that the catalog proved exist. Also compare in-place projections of stable IDs and relationships; do not export user data or credentials. At minimum cover projects, sprints, tasks, subtasks, resources, users, memberships, and workspaces. Example aggregates:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT count(*) FROM projects;
SELECT count(*) FROM tasks;
SELECT count(*) FROM users;
SELECT count(*) FROM workspaces;
SELECT count(*) FROM project_memberships;
SELECT count(*) FROM project_resources;
SELECT count(*) FROM tasks WHERE assignee_id IS NOT NULL;
SELECT count(*) FROM projects WHERE workspace_id IS NOT NULL;
ROLLBACK;
```

Sanitize errors and evidence. Never capture connection strings, password hashes, session/verification tokens, SMTP secrets, or user row contents.

## 3. Rehearse on an isolated branch or clone

Obtain separate authorization to create or use an isolated branch cloned from the exact target. Use its direct connection and repeat the audit. From `backend/`, set `DATABASE_URL_UNPOOLED` only in the operator process, then run:

```text
python -m alembic upgrade c51f01d5e002
python -m alembic current
python -m alembic upgrade c51f01d5e002
```

The second pinned upgrade must be a no-op. Repeat catalog, constraint, count, stable-ID, assignment, ownership, and resource checks. Legacy users must not gain auth accounts; unassigned tasks and projects remain unassigned. Disable real SMTP during rehearsal. Investigate lock contention instead of removing the migrations' five-second lock timeout.

## 4. Request database-operation approval

The approval request must name the non-secret environment/project/branch/database identifiers, verified start and target revisions, exact pending migration files and SHA-256 checksums, direct-connection requirement, successful rehearsal evidence, expected additive objects, preservation comparison, exact command, operator, maintenance window, and recovery point. Production approval must explicitly say production.

Before execution, verify that a usable backup, restore point, or point-in-time branch exists. The exact proposed command is:

```text
python -m alembic upgrade c51f01d5e002
```

Do not execute it without that distinct approval.

## 5. Execute and verify only after approval

From `backend/`, use the approved direct connection and run the exact pinned command once. Re-run the read-only catalog and preservation checks. Confirm `alembic_version.version_num = 'c51f01d5e002'`, all four auth tables and their required columns and constraints exist, and legacy counts and relationships match the approved baseline. `/health` is insufficient; check `GET /api/v1/auth/status` against the confirmed application target.

A real registration or SMTP-delivery test creates data and sends email, so it requires separate account/smoke-test authorization. Keep credentials and tokens out of evidence.

If migration fails, stop, retain sanitized output, and assess the transaction state and revision before retrying. If a successfully migrated production release must be reversed, use the approved source rollback/restore point or a separately planned forward fix. A live Alembic downgrade is excluded because it drops authentication data.
