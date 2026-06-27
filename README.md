# BloodLine — Blood Bank Management System (BBMS)

> A production-grade, modular and secure platform that lets a private blood bank run its
> entire daily operation — donors, collection, lab, components, inventory, requests,
> issue, hospitals, camps, staff, billing, reports, notifications and analytics — from a
> single beautiful dashboard.

[![Status](https://img.shields.io/badge/status-in%20development-E53935)](#)
[![License](https://img.shields.io/badge/license-proprietary-black)](#)

---

## Why BloodLine

Private blood banks still run on paper registers, spreadsheets and WhatsApp groups. This
creates three expensive problems:

1. **Wastage** — units expire because nobody sees them ageing.
2. **Stockouts** — emergencies arrive and the matching group/component is not on hand.
3. **Compliance risk** — government / NABH reporting is reconstructed by hand each month.

BloodLine replaces the paperwork with one interconnected system where a collected bag
flows automatically into lab testing → component separation → inventory → request →
cross-match → issue → billing → report, with full audit trail at every hop.

## Planning Documents (read these first)

This project follows a **plan-before-code** discipline. The complete planning phase lives
in [`/docs`](./docs):

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [SRS.md](./docs/SRS.md) | Software Requirement Specification — scope, actors, functional & non-functional requirements |
| 2 | [IMPROVEMENTS.md](./docs/IMPROVEMENTS.md) | Gap analysis, suggested improvements and missing features |
| 3 | [DATABASE.md](./docs/DATABASE.md) | ER diagram, relationships, indexes, constraints, normalization |
| 4 | [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture, tech stack, folder structure |
| 5 | [WIREFRAMES.md](./docs/WIREFRAMES.md) | UI wireframes and design system |
| 6 | [USER_FLOWS.md](./docs/USER_FLOWS.md) | End-to-end user flows for every role |
| 7 | [API.md](./docs/API.md) | REST API documentation |
| 8 | [ROADMAP.md](./docs/ROADMAP.md) | Phased development roadmap |

The Prisma data model that implements the database design lives at
[`packages/db/prisma/schema.prisma`](./packages/db/prisma/schema.prisma).

## Tech Stack

**Frontend** — Next.js (App Router) · TypeScript · TailwindCSS · shadcn/ui · TanStack
Query · Zustand · Framer Motion

**Backend** — Node.js · Express · Prisma · PostgreSQL · Redis · BullMQ

**Platform** — Docker · Nginx · JWT + refresh tokens · S3-compatible object storage

## Monorepo Layout (target)

```
bloodline/
├── apps/
│   ├── api/        # Express + Prisma backend
│   └── web/        # Next.js frontend
├── packages/
│   ├── db/         # Prisma schema, migrations, seed
│   ├── types/      # Shared TypeScript types / zod schemas
│   └── ui/         # Shared design-system components
├── docs/           # Planning documentation (this phase)
├── docker/         # Dockerfiles, nginx, compose
└── README.md
```

## Getting started (local)

Requirements: Node 20+, pnpm 9, Docker.

```bash
# 1. Install dependencies (generates pnpm-lock.yaml on first run)
pnpm install

# 2. Copy env and start Postgres + Redis (+ api/worker/web/nginx)
cp .env.example .env
docker compose up --build        # full stack; app via nginx at http://localhost:8080

# --- or run the app processes directly against dockerized infra ---
docker compose up -d postgres redis
pnpm db:generate                 # generate Prisma client
pnpm db:push                     # materialize schema (until migrations are committed)
pnpm db:seed                     # roles, permissions, demo org + Super Admin
# Default login: admin@bloodline.local / ChangeMe!123  (override via SEED_ADMIN_* env)
pnpm --filter @bloodline/api dev # API on :4000  (GET /health, /ready)
pnpm --filter @bloodline/api dev:worker
pnpm --filter @bloodline/web dev # Web on :3000
```

Verify: `curl localhost:4000/health` → `{"status":"ok"}`, and `localhost:3000` shows the
skeleton landing page.

## Status

- **Phase 0 — Planning & Design** ✅ (docs + Prisma schema)
- **Phase 1 — Foundations** ✅ monorepo (pnpm + turbo), Docker Compose (postgres, redis,
  api, worker, web, nginx), env validation, structured logging, health/readiness probes,
  the first background job (nightly expiry sweep), shared `types`/`db` packages, seed, CI.
- **Phase 2 — Auth & RBAC** ✅ password hashing (bcrypt), JWT access + rotating refresh
  tokens with reuse detection, OTP/MFA login, forgot/reset password, login lockout,
  `requireAuth` + `requirePermission` middleware with effective-permission resolution
  (role grants + per-user overrides + wildcards), append-only audit logging, and a minimal
  web login (with OTP step) + session context + permission-gated dashboard nav.

Phase 1 follow-ups to do in a networked dev environment (the build sandbox could not reach
the npm tarball CDN): run `pnpm install` to commit `pnpm-lock.yaml`, then switch CI/Docker
back to `--frozen-lockfile`; run `pnpm db:migrate` to generate the initial migration and
switch from `db push` to `migrate deploy`; add ESLint flat config (Phase 3).

Phase 2 onward — implementation per [ROADMAP.md](./docs/ROADMAP.md).

## License

Proprietary — all rights reserved.
