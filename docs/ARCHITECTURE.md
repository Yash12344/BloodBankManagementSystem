# Architecture & Folder Structure — BloodLine

## 1. High-level architecture

```
                        ┌──────────────────────────────┐
                        │           Browser / PWA       │
                        │  Next.js (App Router, RSC)    │
                        │  Tailwind · shadcn/ui · TQ    │
                        └───────────────┬──────────────┘
                                        │ HTTPS (JWT access cookie)
                                ┌───────▼────────┐
                                │     Nginx      │  TLS, gzip, rate-limit
                                └───────┬────────┘
                     ┌──────────────────┼───────────────────┐
            ┌────────▼────────┐                     ┌────────▼────────┐
            │  Next.js server │  SSR/RSC + BFF      │  Express API    │  REST /api/v1
            │  (apps/web)     │  proxies to API     │  (apps/api)     │  zod · RBAC · Prisma
            └─────────────────┘                     └───┬────────┬────┘
                                                        │        │
                                            ┌───────────▼──┐  ┌──▼─────────┐
                                            │ PostgreSQL   │  │  Redis     │
                                            │ (Prisma)     │  │ cache+queue│
                                            └──────────────┘  └──┬─────────┘
                                                                 │ BullMQ
                                                        ┌────────▼─────────┐
                                                        │  Worker process  │  expiry sweep,
                                                        │  (apps/api worker)│  notifications,
                                                        └────────┬─────────┘  reports
                                                                 │
                                          ┌──────────────────────┼─────────────┐
                                   ┌──────▼─────┐         ┌──────▼─────┐  ┌─────▼──────┐
                                   │ S3 storage │         │ Email/SMTP │  │ SMS/WA API │
                                   └────────────┘         └────────────┘  └────────────┘
```

**Layering inside the API** (clean/hexagonal-lite):

```
HTTP route → controller → validation (zod) → service (domain logic, transactions)
          → repository (Prisma) → DB
                         ↘ events → queue → worker (side effects)
```

The **service layer** holds all business rules (eligibility, lab gating, FEFO, issue
checks). Controllers are thin; repositories isolate Prisma so logic stays testable.

## 2. Why this stack

- **Next.js App Router** — RSC for fast first paint, route-level code splitting, built-in
  PWA-ability; acts as a BFF so the browser never holds long-lived secrets.
- **Express + Prisma** — explicit, well-understood REST core; Prisma gives typed,
  parametrised queries (SQLi-safe) and migrations.
- **PostgreSQL** — relational integrity is non-negotiable for clinical traceability.
- **Redis + BullMQ** — offload expiry sweeps, notifications and report generation so the
  request path stays fast and deterministic.
- **Zustand** for ephemeral client UI state, **TanStack Query** for server state/cache.

## 3. Monorepo folder structure (target)

```
bloodline/
├── package.json                 # pnpm workspaces + turbo
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml           # postgres, redis, api, worker, web, nginx
├── .env.example
├── docs/                        # ← this planning phase
│
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── server.ts             # express bootstrap
│   │   │   ├── worker.ts             # BullMQ worker bootstrap
│   │   │   ├── app.ts                # middleware wiring
│   │   │   ├── config/               # env, constants, feature flags
│   │   │   ├── middleware/           # auth, rbac, rate-limit, error, audit
│   │   │   ├── modules/              # one folder per domain module
│   │   │   │   ├── auth/             # controller, service, routes, dto(zod)
│   │   │   │   ├── donors/
│   │   │   │   ├── collection/
│   │   │   │   ├── lab/
│   │   │   │   ├── components/
│   │   │   │   ├── inventory/
│   │   │   │   ├── patients/
│   │   │   │   ├── requests/
│   │   │   │   ├── issue/
│   │   │   │   ├── hospitals/
│   │   │   │   ├── camps/
│   │   │   │   ├── staff/
│   │   │   │   ├── billing/
│   │   │   │   ├── reports/
│   │   │   │   ├── notifications/
│   │   │   │   ├── analytics/
│   │   │   │   └── settings/
│   │   │   ├── jobs/                 # queue definitions + processors
│   │   │   ├── lib/                  # prisma client, redis, s3, mailer, logger
│   │   │   └── utils/
│   │   ├── test/                     # vitest unit + supertest integration
│   │   └── package.json
│   │
│   └── web/
│       ├── src/
│       │   ├── app/                  # App Router
│       │   │   ├── (auth)/login, forgot-password, otp
│       │   │   └── (dashboard)/      # protected layout
│       │   │       ├── dashboard/
│       │   │       ├── donors/
│       │   │       ├── collection/
│       │   │       ├── lab/
│       │   │       ├── inventory/
│       │   │       ├── patients/
│       │   │       ├── requests/
│       │   │       ├── issue/
│       │   │       ├── hospitals/
│       │   │       ├── camps/
│       │   │       ├── staff/
│       │   │       ├── billing/
│       │   │       ├── reports/
│       │   │       └── settings/
│       │   ├── components/           # ui/, charts/, forms/, layout/, command-palette/
│       │   ├── hooks/                # data hooks (TanStack Query)
│       │   ├── lib/                  # api client, auth, utils
│       │   ├── stores/               # zustand
│       │   └── styles/
│       ├── public/                   # icons, manifest.json (PWA), sw
│       └── package.json
│
├── packages/
│   ├── db/
│   │   ├── prisma/schema.prisma      # ← implemented this phase
│   │   ├── prisma/seed.ts
│   │   └── package.json
│   ├── types/                        # shared zod schemas + inferred TS types
│   └── ui/                           # shared design-system primitives
│
└── docker/
    ├── api.Dockerfile
    ├── web.Dockerfile
    └── nginx/default.conf
```

## 4. Security architecture (maps to NFR-4)

| Concern | Control |
|---------|---------|
| AuthN | JWT access (15 min) in httpOnly cookie + rotating refresh (7 d) with reuse detection. |
| AuthZ | RBAC middleware checks `module.action` permission on every route; UI mirrors via permission hook. |
| Passwords | argon2id hashing; breach-check optional. |
| Transport | TLS at Nginx; HSTS; secure cookies. |
| Input | zod validation on every DTO; reject unknown keys. |
| Injection | Prisma parametrised queries; no raw string SQL except reviewed reports. |
| XSS | React escaping + CSP header; sanitise rich text. |
| CSRF | SameSite=strict cookies + double-submit token for state-changing requests. |
| Rate limiting | Redis token bucket per IP+route; stricter on auth. |
| Secrets | Env + encrypted `setting` values; never in client bundle. |
| Audit | Append-only `audit_log` written in the same transaction as the mutation. |

## 5. Environments & deployment

- **Local**: `docker-compose up` brings postgres, redis, api, worker, web, nginx.
- **CI**: lint → typecheck → unit → integration (testcontainers) → build images.
- **Prod**: containers behind Nginx; managed Postgres + Redis; S3 bucket; rolling deploy.
- **Migrations**: `prisma migrate deploy` gated in the release pipeline.

## 6. Observability

Structured JSON logs (pino), request IDs propagated, `/health` and `/ready` probes,
metrics counters for issues/collections/expiry, error tracking hook.
