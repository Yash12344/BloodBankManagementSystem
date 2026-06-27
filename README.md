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
| 9 | [RUNBOOK.md](./docs/RUNBOOK.md) | Operations runbook — deploy, jobs, backup, incidents |
| 10 | [SECURITY.md](./docs/SECURITY.md) | Security posture vs. OWASP Top 10 + checklist |

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
- **Phase 3 — App shell & Design system** ✅ shared `@bloodline/ui` package (Tailwind
  preset with HSL design tokens + dark mode, and shadcn-style primitives: Button, Card,
  Input, Badge, Sheet/Dialog drawer, DropdownMenu, Tooltip, Avatar, Toaster, Skeleton and
  loading/empty/error `DataState`). Dashboard shell with collapsible sidebar (icon +
  tooltip mode, permission-filtered), topbar, dark-mode toggle, ⌘K command palette, and a
  dashboard demonstrating KPI cards, the detail-drawer pattern, async states and undo toast.
- **Phase 4 — Donor & Collection** ✅ donor CRUD with de-duplication, the eligibility
  engine (age/weight/interval/deferral gates, next-eligible computation), deferrals,
  donor card (QR), CSV import/export, and a transactional collection flow that creates the
  donation + blood unit + **PENDING lab record** and updates donor counters in one atomic
  step — blocked for ineligible donors unless an explicit reasoned override is given.
  Web: donors screen (search/filter, register dialog, detail drawer with eligibility and a
  permission-gated "Record donation"). Hermetic tests for the eligibility engine and CSV.
- **Phase 5 — Lab, Components & Inventory** ✅ the safety spine. Lab worklist + TTI panel
  with **reactive auto-quarantine**, approval gated on all-non-reactive (reactive can never
  reach stock), and reactive rejection that permanently defers the donor. Component
  separation of approved units into PRBC/FFP/Platelets/Cryo/Whole with barcodes, type-based
  expiry and storage — written atomically with the movement ledger + cached counters
  (optimistic concurrency). Real-time inventory matrix (group × component, colour-coded
  levels), expiring-soon, movement ledger, **FEFO** selection, and an hourly low-stock job
  (plus the existing nightly expiry sweep). Web: colour-coded inventory grid with cell
  drawer, and a lab worklist with the screening/approve/reject flow.
- **Phase 6 — Patients, Requests, Cross-match & Issue** ✅ closes the loop. Patient CRUD;
  blood requests with emergency surfacing; approval that **reserves units via FEFO** under
  optimistic concurrency (two approvals can't grab the same unit); cancel that releases
  reservations; cross-match; and the **atomic issue** — every guard rail enforced
  server-side (unit reserved for this request, compatible cross-match, not expired), moving
  RESERVED→ISSUED with a version guard, updating the ledger + counters, consuming
  reservations, completing the request, and generating a DRAFT invoice from the price list.
  Web: requests screen (create, approve, and a fulfil drawer that cross-matches then issues)
  and a patients screen. Tests for invoice math (integer minor units, per-line GST rounding).
- **Phase 7 — Hospitals, Camps & Staff** ✅ hospitals with doctors, request/issue history
  and live outstanding (sum of unpaid/partial invoice balances); camp lifecycle with
  volunteers/expenses, donor reminders, and **statistics that roll up the collections linked
  to each camp** (count, volume, unique donors, finance); staff profiles, per-day attendance,
  leave requests/approval, and per-user activity from the audit log. Web: hospitals, camps
  (with a stats drawer) and staff screens. Test for camp finance summary.
- **Phase 8 — Billing & Finance** ✅ invoices list/detail; **idempotent payments**
  (Idempotency-Key → unique payment, safe to retry; balance/status recomputed from the
  authoritative payment sum under an optimistic version guard, hospital outstanding kept in
  sync); void (blocked when payments exist); expenses ledger; **daily cash book** (cash in
  by method vs expenses); receivables **aging** buckets; and price-list management. Web:
  billing screen with the daily-cash summary and an invoice drawer that records payments.
  Tests for payment status/balance derivation (never negative, exact PAID/PARTIAL/UNPAID).
- **Phase 9 — Reports, Notifications & Analytics** ✅ report engine with CSV/JSON exports
  for inventory, donors, collection, issue, lab and finance (date-ranged); a notification
  layer — in-app inbox (list, unread count, mark read/all) surfaced via a topbar bell, plus
  a **transactional-outbox** delivery pipeline (email/SMS/WhatsApp adapters, per-minute
  worker drain with exponential-backoff retries); and analytics (dashboard KPI summary now
  driving the real dashboard, collection/revenue trends, demand by group, component
  distribution, top donors/hospitals). Web: notification bell, reports page (preview +
  CSV download) and an analytics page with trend/ranking visualizations.
- **Phase 10 — Hardening & launch** ✅ **look-back/recall** (trace a donor's full
  unit→component→issue chain; recall quarantines in-stock units, blacklists the donor and
  notifies affected hospitals); **return-from-hospital** (cold-chain-windowed restock or
  discard); a **settings/audit surface** (organization, users, role×permission matrix,
  append-only audit log); expanded **demo seed**; an end-to-end **smoke script** walking the
  whole pipeline; plus the [ops runbook](./docs/RUNBOOK.md) and
  [security posture](./docs/SECURITY.md). Web: settings page, donor recall action, the
  notification bell, and the live dashboard. Tests for the cold-chain window.
- **Phase 11 — AI features (optional, flagged)** ✅ deterministic, always-on intelligence
  (demand forecasting via moving-average + linear trend, low-stock prediction with
  days-to-stockout and risk bands, smart donor suggestions ranked by group match / recency /
  reliability) plus LLM-backed features behind `FEATURE_AI` + an Anthropic API key
  (natural-language search → structured query, auto report summaries) that **degrade
  gracefully** to a keyword heuristic / templated summary when disabled. Uses the official
  Anthropic SDK with `claude-opus-4-8`. Web: a predicted-low-stock card on analytics.
  Tests for the forecasting math and donor-ranking logic.

Phase 1 follow-ups to do in a networked dev environment (the build sandbox could not reach
the npm tarball CDN): run `pnpm install` to commit `pnpm-lock.yaml`, then switch CI/Docker
back to `--frozen-lockfile`; run `pnpm db:migrate` to generate the initial migration and
switch from `db push` to `migrate deploy`; add ESLint flat config (Phase 3).

Phase 2 onward — implementation per [ROADMAP.md](./docs/ROADMAP.md).

## License

Proprietary — all rights reserved.
