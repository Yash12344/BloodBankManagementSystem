# Operations Runbook — BloodLine

Operational guide for deploying and running BloodLine in production.

## 1. Prerequisites
- PostgreSQL 15+, Redis 7+, an S3-compatible bucket, and SMTP/SMS/WhatsApp gateway
  credentials (optional; channels degrade to logging when unset).
- Node 20, pnpm 9, Docker.

## 2. Configuration
Copy `.env.example` to `.env` and set every value. Critical secrets: `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET` (≥16 chars, rotate per environment), `DATABASE_URL`, `REDIS_URL`.
Set `COOKIE_SECURE=true` behind TLS. Set `SEED_ADMIN_PASSWORD` and rotate after first login.

## 3. First deploy
```bash
pnpm install
pnpm --filter @bloodline/db generate
pnpm --filter @bloodline/db migrate:deploy   # or `db push` until the first migration is committed
pnpm --filter @bloodline/db seed              # roles, permissions, admin, price list, demo data
docker compose up -d --build                  # postgres, redis, api, worker, web, nginx
```
App is served by Nginx on `:8080` (web + `/api`). API health: `GET /health`, readiness:
`GET /ready`.

## 4. Processes
- **api** — stateless HTTP; scale horizontally behind Nginx.
- **worker** — background jobs (single or few replicas):
  - nightly **expiry sweep** (01:00) — expires components, updates counters.
  - hourly **low-stock check** — raises in-app alerts per group×component.
  - per-minute **outbox drain** — delivers email/SMS/WhatsApp with backoff retries.

## 5. Migrations
Generate in a dev environment (`pnpm db:migrate`), commit the `prisma/migrations` folder,
then `pnpm db:migrate:deploy` in the release pipeline. Never edit applied migrations.

## 6. Backup & restore
- **Database**: scheduled `pg_dump` (logical) plus volume snapshots. Restore with
  `pg_restore` into a fresh DB, then point `DATABASE_URL` at it.
- **Object storage**: enable bucket versioning; replicate to a second region.
- **Redis** is a cache/queue — safe to lose; jobs reschedule on worker start. The outbox
  lives in PostgreSQL, so queued notifications survive a Redis flush.
- Test restores quarterly. Clinical and financial records are soft-deleted and retained per
  statutory period; never hard-delete.

## 7. Monitoring & alerts
- Liveness `/health`, readiness `/ready` (checks DB + Redis) for orchestrator probes.
- Structured JSON logs (pino) with request IDs. Ship to your log aggregator.
- Alert on: readiness failures, worker job failure rate, outbox `FAILED` rows, p95 latency,
  and DB connection saturation.

## 8. Routine operations
- **Recall a donor**: `POST /api/v1/lookback/:donorId/recall` (doctor) — quarantines
  in-stock units, blacklists the donor, notifies affected hospitals. Trace first with
  `GET /api/v1/lookback/:donorId/trace`.
- **Return from hospital**: `POST /api/v1/issues/:id/return` — restocks within the
  cold-chain window, otherwise discards.
- **Audit**: `GET /api/v1/settings/audit-logs` for the append-only trail.

## 9. Incident response
- **DB down** → `/ready` returns 503; API serves cached reads only where applicable; fix DB,
  no data action needed (transactions roll back cleanly).
- **Redis down** → jobs pause; request path unaffected except rate limiting; restore Redis,
  jobs resume.
- **Gateway outage** → outbox retries with backoff; no message lost.
- **Suspected bad unit** → run a recall immediately; the audit log captures the action.

## 10. Smoke test
After a deploy, run the end-to-end smoke against the environment:
```bash
SMOKE_BASE_URL=http://localhost:4000 SMOKE_EMAIL=admin@bloodline.local \
  SMOKE_PASSWORD=ChangeMe!123 pnpm --filter @bloodline/api tsx scripts/smoke.ts
```
It walks donor → collect → lab approve → separate → request → approve → cross-match →
issue → pay and asserts each step.
