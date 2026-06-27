# API Documentation — BloodLine REST API

**Base URL:** `/api/v1` · **Format:** JSON · **Auth:** JWT access token (httpOnly cookie
`bl_access`) + refresh cookie `bl_refresh` · **Validation:** zod on every request body.

## Conventions

- **Auth**: send cookies automatically; `Authorization: Bearer <token>` also accepted for
  server-to-server. Every non-auth route requires authentication and an RBAC permission
  `module.action`.
- **Pagination**: `?page=1&limit=25&sort=createdAt:desc`. Responses wrap lists in
  `{ data, meta: { page, limit, total, totalPages } }`.
- **Filtering**: `?q=` for search; module-specific filters documented per endpoint.
- **Idempotency**: write endpoints accept `Idempotency-Key` header; payments require it.
- **Concurrency**: send `If-Match: <version>` on updates to versioned resources; mismatch →
  `409 Conflict`.
- **Errors**: `{ error: { code, message, details? } }` with proper HTTP status.

### Standard status codes
`200 OK` · `201 Created` · `204 No Content` · `400 Validation` · `401 Unauthenticated` ·
`403 Forbidden (RBAC)` · `404 Not Found` · `409 Conflict` · `422 Domain rule violated` ·
`429 Rate limited` · `500 Server`.

---

## 1. Auth — `/auth`

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/auth/login` | `{ email, password }` | Returns user + sets cookies, or `otpRequired:true`. |
| POST | `/auth/otp/verify` | `{ challengeId, code }` | Completes MFA login. |
| POST | `/auth/refresh` | — (refresh cookie) | Rotates tokens; reuse detection revokes family. |
| POST | `/auth/logout` | — | Clears session. |
| POST | `/auth/forgot-password` | `{ email }` | Sends reset link (always 200). |
| POST | `/auth/reset-password` | `{ token, password, otp }` | Sets new password. |
| GET  | `/auth/me` | — | Current user + permissions. |

## 2. Donors — `/donors` (perm `donors.*`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/donors` | List; filters: `q, bloodGroup, eligible, status, lastDonationFrom/To`. |
| POST | `/donors` | Create. Body validated; computes `nextEligibleAt`. |
| GET | `/donors/:id` | Detail + counters. |
| PATCH | `/donors/:id` | Update (If-Match). |
| DELETE | `/donors/:id` | Soft delete (undo window). |
| GET | `/donors/:id/donations` | Donation history. |
| GET | `/donors/:id/card` | Donor card PDF (QR). |
| POST | `/donors/import` | CSV bulk import → validation report. |
| GET | `/donors/export` | CSV/Excel export. |
| GET | `/donors/:id/eligibility` | Eligibility check result for today. |

**Donor create body (zod):**
```json
{ "name": "Rohit Mehta", "dob": "1994-02-11", "gender": "MALE",
  "bloodGroup": "O_POS", "weightKg": 72, "mobile": "98xxxxxxxx",
  "email": "rohit@example.com", "address": "…", "occupation": "Engineer",
  "govtIdType": "AADHAAR", "govtIdNo": "xxxx", "emergencyContact": "…" }
```

## 3. Collection — `/collections` (perm `collection.*`)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/collections` | Create donation+unit+pending lab in one tx. Blocks if donor ineligible unless `override` + reason (Admin). |
| GET | `/collections` | List; filters: `status, donorId, campId, dateFrom/To`. |
| GET | `/collections/:id` | Detail. |
| PATCH | `/collections/:id/status` | Transition status. |

## 4. Lab — `/lab` (perm `lab.*`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/lab/worklist` | Units pending/processing tests. |
| GET | `/lab/:unitId` | Lab record. |
| PUT | `/lab/:unitId/tests` | Record HB/HIV/HBsAg/HCV/Malaria/Syphilis/typing. |
| POST | `/lab/:unitId/approve` | Doctor verify → unit APPROVED (422 if any reactive). |
| POST | `/lab/:unitId/reject` | Reject + reason → unit DISCARDED. |

## 5. Components — `/components` (perm `components.*`)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/units/:unitId/separate` | `{ types: ["PRBC","FFP"] }` → creates components, barcodes, expiry; moves to inventory. Requires APPROVED unit. |
| GET | `/components/:id` | Detail / traceability. |
| GET | `/components/barcode/:barcode` | Scan lookup. |
| POST | `/components/:id/discard` | Discard + reason → movement DISCARD. |

## 6. Inventory — `/inventory` (perm `inventory.*`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/inventory` | Stock matrix (group × component) with counters + colour level. |
| GET | `/inventory/expiring?days=7` | Units expiring soon. |
| GET | `/inventory/movements` | Ledger, filterable. |
| GET | `/inventory/:group/:type/units` | Individual units in a cell. |

## 7. Patients — `/patients` (perm `patients.*`)
CRUD `GET/POST/GET:id/PATCH/DELETE`; filters `q, hospitalId, bloodGroup, status`.

## 8. Requests — `/requests` (perm `requests.*`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/requests` | Queue; filters `status, priority, hospitalId`. |
| POST | `/requests` | Create (online/hospital/emergency). |
| GET | `/requests/:id` | Detail with reservations. |
| POST | `/requests/:id/approve` | Doctor approve → reserve units (422 if no stock = partial). |
| POST | `/requests/:id/reject` | Reject + reason. |
| POST | `/requests/:id/cancel` | Cancel → release reservations. |

## 9. Cross-match & Issue — `/crossmatch`, `/issues` (perm `issue.*`)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/crossmatch` | `{ requestId, componentId, patientSampleRef, result }`. |
| POST | `/issues` | `{ requestId, componentBarcodes[] }` → atomic issue, FEFO-validated, generates slip + draft invoice. 422 if cross-match not compatible or unit invalid. |
| GET | `/issues/:id` | Detail + slip URL. |
| POST | `/issues/:id/return` | Return within cold-chain window → re-stock or discard. |

## 10. Hospitals — `/hospitals` (perm `hospitals.*`)
CRUD + `GET /hospitals/:id/requests`, `/issues`, `/invoices`, `/outstanding`,
nested `hospital-doctors`.

## 11. Camps — `/camps` (perm `camps.*`)
CRUD + `volunteers`, `expenses`, `donors`, `GET /camps/:id/stats`,
`POST /camps/:id/remind`.

## 12. Staff — `/staff` (perm `staff.*`)
CRUD profiles + `attendance`, `leaves`, `GET /staff/:id/activity`.

## 13. Billing — `/invoices`, `/payments`, `/expenses` (perm `billing.*`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/invoices` | List; `status, hospitalId, dateFrom/To`. |
| GET | `/invoices/:id` | Detail + lines + payments + PDF. |
| POST | `/invoices/:id/payments` | Record payment (**Idempotency-Key required**). |
| POST | `/invoices/:id/void` | Void with reason. |
| GET/POST | `/expenses` | Ledger. |
| GET | `/billing/daily-cash?date=` | Daily cash book. |
| GET/PUT | `/billing/price-list` | Component/group pricing. |

## 14. Reports — `/reports` (perm `reports.*`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/reports/:type?range=&format=pdf\|excel\|csv` | type ∈ inventory,donors,collection,issue,lab,finance,government. Large reports return `202` + job id. |
| GET | `/reports/jobs/:id` | Poll generated report; returns file URL when ready. |

## 15. Notifications — `/notifications` (perm `notifications.view`)
`GET /notifications` (inbox), `POST /notifications/:id/read`,
`POST /notifications/read-all`, `GET /notifications/unread-count`.

## 16. Analytics — `/analytics` (perm `analytics.view`)
`GET /analytics/collection-trends`, `/demand-trends`, `/inventory-heatmap`,
`/top-hospitals`, `/top-donors`, `/revenue`, `/growth`.
AI (feature-flagged): `POST /ai/search` (NL → query), `GET /ai/forecast/demand`,
`GET /ai/forecast/low-stock`, `POST /ai/donor-suggestions`, `POST /ai/report-summary`.

## 17. Settings — `/settings` (perm `settings.*`, Super Admin/Admin)
`GET/PUT /settings/organization`, `/branches`, `/users`, `/roles`, `/permissions`
(role×permission matrix), `/gateways` (email/sms/whatsapp, secrets write-only),
`/theme`, `POST /settings/backup`, `/settings/restore`.

## 18. Global search & health
`GET /search?q=` (cross-entity instant search) · `GET /health` · `GET /ready`.

---

## Rate limiting
Auth endpoints: 10 req/min/IP. General: 120 req/min/user. Exports/reports: 10/min.
Exceeding → `429` with `Retry-After`.

## Webhooks (outbound, optional)
Bank can register URLs for `request.emergency`, `inventory.low_stock`,
`component.expired` events (HMAC-signed payloads).
