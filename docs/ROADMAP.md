# Development Roadmap — BloodLine

Phased delivery. Each phase is independently shippable and builds on the last. "DoD" =
Definition of Done. Estimates assume a small senior team; adjust to capacity.

---

## Phase 0 — Planning & Design ✅ (this commit)
SRS, improvements, database design, architecture, wireframes, user flows, API docs,
roadmap, and the Prisma schema implementing the data model.
**DoD:** docs reviewed; schema compiles; scope agreed.

## Phase 1 — Foundations
Monorepo (pnpm + turbo), Docker Compose (postgres, redis, api, worker, web, nginx), env
config, Prisma migrate + seed, shared `types` package, logging/health, CI (lint, typecheck,
test, build).
**DoD:** `docker-compose up` runs a healthy empty app; migrations + seed succeed; CI green.

## Phase 2 — Auth & RBAC
Login, refresh-token rotation, forgot-password, OTP/MFA, RBAC middleware + permission
matrix, user/role/permission settings, audit-log infrastructure, rate limiting, security
headers.
**DoD:** every route guarded; roles enforced server + UI; auth tests pass.

## Phase 3 — App shell & Design system
Next.js dashboard layout (sidebar, topbar, dark mode, command palette ⌘K), shadcn/ui
theme with red accent, shared `ui` package, list/detail/drawer patterns, loading/empty/
error states, toast + undo, responsive breakpoints, PWA manifest.
**DoD:** navigable shell; design tokens applied; Lighthouse PWA/A11y pass.

## Phase 4 — Donor & Collection (core in)
Donor CRUD + eligibility engine + card/QR + import/export; Collection create with
auto-unit + auto-lab; status lifecycle; deferrals.
**DoD:** register → collect produces a unit with a pending lab record; eligibility gates work.

## Phase 5 — Lab, Components & Inventory (the safety spine)
Lab worklist + TTI + typing + approve/reject with reactive auto-discard; component
separation with barcodes/expiry/location; real-time inventory matrix with counters,
colour levels, movement ledger; expiry & low-stock jobs; FEFO selection.
**DoD:** approved unit → components → inventory; reactive unit never reaches stock; nightly
sweep marks expiries; counters reconcile.

## Phase 6 — Patients, Requests, Cross-match & Issue
Patient CRUD; request creation/approval/reservation; cross-match; atomic issue with
barcode scan + FEFO + stock decrement + issue slip; emergency dashboard surfacing.
**DoD:** end-to-end request → approve → cross-match → issue works atomically with all
server-side guard rails; concurrency-safe.

## Phase 7 — Hospitals, Camps, Staff
Hospital + doctors + history + outstanding; camp lifecycle (volunteers, expenses, revenue,
stats, reminders) feeding collections; staff profiles, attendance, leaves, activity logs.
**DoD:** camp collections roll up to stats; hospital request/issue history accurate.

## Phase 8 — Billing & Finance
Price list, draft invoice on issue, GST, idempotent payments, receipts, expenses, daily
cash book, hospital outstanding/aging.
**DoD:** invoice totals + GST correct; payments idempotent; finance figures reconcile.

## Phase 9 — Reports, Notifications, Analytics
Report engine (PDF/Excel/CSV, scheduled, government templates); notification channels
(email/SMS/WhatsApp) via outbox with triggers; analytics dashboards (trends, heatmap, top
donors/hospitals, revenue, growth).
**DoD:** each report type exports correctly; alerts delivered exactly once; analytics match
source data.

## Phase 10 — Hardening & Launch
Look-back/recall workflow, inter-branch transfer, return-from-hospital, backup/restore,
load/perf tuning + indexes, security review (OWASP), accessibility audit, full E2E suite,
seeded demo, ops runbook, production deploy.
**DoD:** security & a11y sign-off; E2E green; perf targets (NFR-1/2) met; deployed.

## Phase 11 — Intelligence (optional, flagged)
Low-stock prediction, demand forecasting, smart donor suggestions, NL search, auto report
summaries — behind feature flags and configurable AI provider.
**DoD:** features improve a baseline metric in evaluation; degrade gracefully when disabled.

---

## Cross-cutting (every phase)
Tests alongside code (unit on services, integration on routes, E2E on flows), audit logging
on mutations, docs kept current, accessibility & responsive checks, no placeholder code.

## Sequencing rationale
Auth and the design system come before features so every module is built secure and
on-brand from day one. The **lab → components → inventory** spine (Phase 5) precedes
request/issue because issue safety depends entirely on it. Billing follows issue because
invoices are generated at issue time. Reports/notifications/analytics come once there is
real data to report on. AI is last and optional so the product ships without it.

## Risk register (top items)
| Risk | Mitigation |
|------|------------|
| Concurrency double-issue of a unit | optimistic locking + transactional issue (Phase 6). |
| Counter drift on inventory | ledger as source of truth + nightly reconciliation. |
| Gateway outages (SMS/WA) | outbox + retries + graceful degradation. |
| Regulatory format changes | template-driven reports, config not code. |
| Scope creep | phase gates with explicit DoD. |
