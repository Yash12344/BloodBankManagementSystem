# Suggested Improvements & Missing Features — BloodLine

This document is the architect's value-add: gaps in the original brief, risks, and
high-leverage features that materially improve safety, compliance and commercial appeal.
Items are prioritised **P0** (must, safety/compliance), **P1** (strong value), **P2**
(differentiator).

---

## 1. Safety & Clinical Integrity (P0)

| # | Improvement | Why it matters |
|---|-------------|----------------|
| 1.1 | **Mandatory parent→component→issue traceability chain** | Recall management: if a donor later tests positive, every product and recipient must be traceable in seconds. |
| 1.2 | **Hard gate: no inventory without Approved lab record** | Prevents untested blood ever being issuable — the single most important safety rule. |
| 1.3 | **Look-back / recall workflow** | When a donor seroconverts, auto-flag all prior units/recipients and notify. Not in original brief. |
| 1.4 | **Cross-match enforced server-side** | UI checks are bypassable; the API must reject incompatible issue. |
| 1.5 | **Reverse blood typing + Rh + antibody screen fields** | Original lists "blood typing" only; real labs need forward+reverse grouping and Rh. |
| 1.6 | **Donor adverse-reaction / vasovagal log** | Required for donor safety and deferral decisions. |
| 1.7 | **Bag/segment number uniqueness + barcode checksum** | Eliminates mis-scan and duplicate-bag errors at issue. |

## 2. Compliance & Audit (P0/P1)

| # | Improvement | Why |
|---|-------------|-----|
| 2.1 | **Immutable, append-only audit log** | Regulatory inspections and dispute resolution. |
| 2.2 | **Discard register with reason codes** | Statutory requirement; feeds wastage analytics. |
| 2.3 | **e-Rakt-Kosh / government export templates** | Banks must file these; auto-generation is a big selling point. |
| 2.4 | **Digital consent capture (donor questionnaire + signature)** | Legal requirement before phlebotomy. |
| 2.5 | **Temperature-excursion log for storage equipment** | Cold-chain compliance; tie alerts to inventory location. |
| 2.6 | **Data retention policy engine** | Auto-archive after statutory period, never silent delete. |

## 3. Operational Efficiency (P1)

| # | Improvement | Why |
|---|-------------|-----|
| 3.1 | **FEFO issue suggestion (First-Expiry-First-Out)** | Cuts wastage automatically by guiding which unit to issue. |
| 3.2 | **Reservation expiry + auto-release** | Frees held units when requests lapse. |
| 3.3 | **Inter-branch transfer module** | Multi-branch banks balance stock; not in brief. |
| 3.4 | **Donor SMS recall campaign for a needed group** | "We need O- today" blast to eligible nearby donors. |
| 3.5 | **Walk-in queue / token system for camps & reception** | Smooths peak load. |
| 3.6 | **Wastage & return-from-hospital workflow** | Units returned within cold-chain window can re-enter stock. |

## 4. Financial Robustness (P1)

| # | Improvement | Why |
|---|-------------|-----|
| 4.1 | **Money stored as integer minor units** | Floating-point money is a classic, costly bug. |
| 4.2 | **Configurable price list per component/group + concession rules** | Real billing has camps/relatives concessions. |
| 4.3 | **Credit-limit & outstanding-aging for hospitals** | Controls receivables risk. |
| 4.4 | **Idempotent payment posting** | Prevents double-charge on retries. |

## 5. Reliability & Engineering (P1)

| # | Improvement | Why |
|---|-------------|-----|
| 5.1 | **Optimistic concurrency (row version) on units & inventory** | Two staff issuing the same bag simultaneously must not both succeed. |
| 5.2 | **Transactional multi-step operations** | Issue = decrement + mark + invoice must be atomic. |
| 5.3 | **Outbox pattern for notifications** | Guarantees an alert is sent exactly once even on crash. |
| 5.4 | **Idempotency keys on write APIs** | Safe retries from flaky mobile/camp networks. |
| 5.5 | **Background jobs for expiry sweep, reminders, reports** | Keeps request path fast and deterministic. |

## 6. UX & Accessibility (P1/P2)

| # | Improvement | Why |
|---|-------------|-----|
| 6.1 | **Command palette (⌘K) global search & actions** | Matches the Linear/Notion feel the brief wants. |
| 6.2 | **Offline drafts + PWA sync for camps** | Camps have poor connectivity; capture offline, sync later. |
| 6.3 | **WCAG AA, keyboard-first, screen-reader labels** | Accessibility + many users on shared terminals. |
| 6.4 | **Undo-delete toast (soft delete window)** | Forgiving UX; avoids data loss. |
| 6.5 | **Saved views / filters per user** | Power users live in filtered lists. |

## 7. Intelligence (P2)

| # | Improvement | Why |
|---|-------------|-----|
| 7.1 | **Demand forecasting (seasonality + history)** | Order/recruit ahead of shortages. |
| 7.2 | **Low-stock prediction with lead-time** | Alert before stockout, not at zero. |
| 7.3 | **Smart donor suggestions for a request** | Rank eligible donors by group, recency, proximity. |
| 7.4 | **Natural-language search & auto report summary** | Differentiator; gated behind feature flag and provider config. |

## 8. Multi-tenancy & Growth (P2)

| # | Improvement | Why |
|---|-------------|-----|
| 8.1 | **Branch-scoped data isolation from day one** | Even a "single bank" grows to multiple branches. |
| 8.2 | **Feature flags & plan tiers** | Commercial packaging. |
| 8.3 | **Public donor self-registration & request portal** | Reduces reception load; lead generation. |

---

## Recommended scope adjustments vs. original brief

- **Add** look-back/recall, discard register, consent capture, cold-chain log,
  inter-branch transfer, FEFO — these are non-negotiable for a *real* blood bank.
- **Harden** all clinical gates on the server, not just UI.
- **Defer** live device/LIS integration and live e-Rakt-Kosh sync to a later phase; ship
  the export-file versions first.
- **Treat AI features as additive** behind flags so the core product ships without them.
