# Software Requirement Specification (SRS) — BloodLine BBMS

**Version:** 1.0  ·  **Status:** Baseline  ·  **Audience:** Engineering, Product, QA, Compliance

---

## 1. Introduction

### 1.1 Purpose
This SRS defines the requirements for **BloodLine**, a web-based Blood Bank Management
System for a single private blood bank (multi-branch capable). It is the contract between
stakeholders and the engineering team and the source of truth for scope.

### 1.2 Scope
BloodLine digitises the full lifecycle of blood from **donor registration** through
**collection, laboratory screening, component separation, inventory, request, cross-match,
issue, billing** and **regulatory reporting**, plus supporting operations (camps, staff,
hospitals, notifications, analytics, settings).

Out of scope (v1): apheresis machine integration, HL7/LIS device interfacing, national
e-Rakt-Kosh live sync (export files only), patient-facing mobile app (web PWA covers it).

### 1.3 Definitions
| Term | Meaning |
|------|---------|
| **Unit / Bag** | A single physical blood collection identified by a bag number. |
| **Component** | A separated product of a unit: Whole Blood, PRBC, Platelets, FFP, Cryoprecipitate. |
| **TTI** | Transfusion-Transmitted Infection screening (HIV, HBsAg, HCV, Syphilis, Malaria). |
| **Cross-match** | Compatibility test between donor unit and patient sample before issue. |
| **Deferral** | Temporary/permanent rejection of a donor on medical/eligibility grounds. |
| **Replacement** | Donation given to replace blood used by a specific patient. |

### 1.4 Standards & Compliance Targets
Drugs & Cosmetics Act (India) blood bank rules, NABH/NACO record-keeping, e-Rakt-Kosh
report formats, GST invoicing. Architecture remains region-agnostic so labels/fields are
configurable.

---

## 2. Overall Description

### 2.1 Product Perspective
A standalone full-stack web application (Next.js frontend + Express/Prisma backend +
PostgreSQL + Redis). Deployed via Docker behind Nginx. Stateless API with JWT auth; async
jobs (notifications, report generation, expiry sweeps) via BullMQ on Redis.

### 2.2 User Classes (Roles)
| Role | Primary responsibility |
|------|------------------------|
| **Super Admin** | Full access; org/branch/user/permission config, backups. |
| **Admin** | Branch operations management; all modules except destructive system settings. |
| **Doctor** | Approve/reject blood requests, sign off lab/cross-match, medical decisions. |
| **Lab Technician** | TTI tests, blood typing, cross-match, component QA. |
| **Reception** | Donor registration, patient intake, request entry, printing cards. |
| **Data Entry** | Bulk/manual data capture, imports, corrections. |
| **Accountant** | Billing, invoices, payments, GST, expenses, financial reports. |
| **Blood Collection Staff** | Phlebotomy records, camp collection. |
| **Store Manager** | Inventory, storage locations, discards, expiry handling. |

Permissions are **module × action** (view/create/edit/delete/approve/export) and are
role-default but per-user overridable.

### 2.3 Operating Environment
Modern evergreen browsers (Chrome, Edge, Firefox, Safari), responsive for desktop/tablet/
mobile, installable as a PWA for camp/offline use.

### 2.4 Design & Implementation Constraints
- Red accent `#E53935` on white; full dark mode; WCAG AA contrast.
- All money in minor units (paise) as integers; never floats.
- All timestamps stored UTC; displayed in branch timezone.
- No hard deletes of clinical records — soft delete + audit + undo window.

---

## 3. Functional Requirements

Each requirement is tagged `FR-<MODULE>-<n>` and prioritised **M** (must), **S** (should),
**C** (could).

### 3.1 Authentication & Access (AUTH)
- **FR-AUTH-1 (M)** Email/username + password login with bcrypt/argon2 hashing.
- **FR-AUTH-2 (M)** JWT access token (short-lived) + rotating refresh token (httpOnly cookie).
- **FR-AUTH-3 (M)** Forgot-password via email reset link (expiring, single-use).
- **FR-AUTH-4 (M)** OTP second factor (email/SMS) for sensitive roles and password reset.
- **FR-AUTH-5 (M)** Role-based access control enforced on **every** API route and UI element.
- **FR-AUTH-6 (S)** Account lockout after N failed attempts; rate-limited login.
- **FR-AUTH-7 (S)** Session list & remote logout; force-logout on role change.

### 3.2 Dashboard (DASH)
- **FR-DASH-1 (M)** Role-aware KPI cards: today's collection, issued, requests, emergency
  requests, pending tests, total inventory units, units expiring ≤7 days, today's revenue,
  active camp stats.
- **FR-DASH-2 (M)** Charts: weekly & monthly collection, inventory trend, demand by blood
  group, component distribution.
- **FR-DASH-3 (M)** Recent activity timeline, quick actions, pending tasks, pinned reports.

### 3.3 Donor Management (DON)
- **FR-DON-1 (M)** CRUD donor with: photo, name, DOB/age, gender, blood group, weight,
  mobile, email, address, occupation, medical history, emergency contact, government ID,
  status, donation count, last donation, computed next-eligible date.
- **FR-DON-2 (M)** Eligibility engine: age 18–65, weight ≥ 45 kg, ≥ 90 days (male) / 120
  days (female) since last whole-blood donation; deferral rules; flag ineligible donors.
- **FR-DON-3 (M)** Search, multi-filter (group, eligibility, location, last-donation range).
- **FR-DON-4 (M)** Donation history per donor; print donor card with QR.
- **FR-DON-5 (S)** CSV import/export; bulk upload with validation report.
- **FR-DON-6 (S)** De-duplication by mobile + government ID.

### 3.4 Blood Collection (COL)
- **FR-COL-1 (M)** Create collection: auto bag number, date, donor, group, volume,
  collection staff, donation type (voluntary/replacement), source (camp/walk-in/hospital).
- **FR-COL-2 (M)** Status lifecycle: Collected → Processing → Completed, or Rejected.
- **FR-COL-3 (M)** Block collection if donor ineligible (with override + reason by Admin).
- **FR-COL-4 (M)** On creation, automatically open a Lab Test record for the unit.

### 3.5 Lab Testing (LAB)
- **FR-LAB-1 (M)** Record HB, HIV, HBsAg, HCV, Malaria, Syphilis, blood typing, cross-match.
- **FR-LAB-2 (M)** Each TTI = Reactive/Non-Reactive; any reactive ⇒ unit auto-quarantined
  then Rejected/Discarded; non-reactive set ⇒ Approved.
- **FR-LAB-3 (M)** Technician + verifying doctor sign-off; comments; immutable once approved.
- **FR-LAB-4 (M)** Only **Approved** units may proceed to component separation/inventory.

### 3.6 Blood Components (CMP)
- **FR-CMP-1 (M)** On lab approval, split parent unit into selected components (Whole Blood,
  PRBC, Platelets, FFP, Cryoprecipitate) per configurable separation rules.
- **FR-CMP-2 (M)** Each component: own expiry (by type), storage temp, storage location,
  barcode + QR, status. Parent↔child traceability preserved.
- **FR-CMP-3 (M)** Expiry computed from component type (e.g. PRBC 42d, Platelets 5d, FFP 1y).

### 3.7 Inventory (INV)
- **FR-INV-1 (M)** Real-time stock by branch × blood group × component with counts:
  available, reserved, issued, expired, discarded.
- **FR-INV-2 (M)** Colour-coded levels (critical/low/ok); configurable thresholds per group.
- **FR-INV-3 (M)** Automatic expiry sweep job marks expired units & raises alerts.
- **FR-INV-4 (M)** Low-stock alerts to Store Manager/Admin.
- **FR-INV-5 (S)** Inventory heatmap and ageing buckets.

### 3.8 Patients (PAT)
- **FR-PAT-1 (M)** CRUD patient: demographics, hospital, treating doctor, diagnosis,
  required group/component/units, medical notes, status.
- **FR-PAT-2 (M)** Link patient to one or more blood requests and issues.

### 3.9 Blood Requests (REQ)
- **FR-REQ-1 (M)** Create request (online portal / hospital / emergency) with priority
  Critical/Normal, group, component, units, required-by datetime.
- **FR-REQ-2 (M)** Status: Pending → Approved/Rejected → Completed; Doctor approval gate.
- **FR-REQ-3 (M)** Reservation: on approval, hold matching units (move to Reserved).
- **FR-REQ-4 (M)** Emergency requests surface on dashboard + notification fan-out.

### 3.10 Blood Issue (ISS)
- **FR-ISS-1 (M)** Issue against an approved request: barcode scan units, patient, hospital,
  doctor, units, component, cross-match reference, issuing staff, datetime.
- **FR-ISS-2 (M)** Issue blocked unless cross-match recorded compatible and unit Approved &
  not expired/reserved-for-other.
- **FR-ISS-3 (M)** On issue: decrement inventory, set unit Issued, generate issue slip +
  trigger billing draft.

### 3.11 Hospital Management (HOS)
- **FR-HOS-1 (M)** CRUD hospitals with contacts, address, associated doctors.
- **FR-HOS-2 (M)** Request & issue history per hospital; billing + outstanding balance.

### 3.12 Blood Donation Camps (CAMP)
- **FR-CAMP-1 (M)** Manage upcoming/past camps: location, date, organizer, volunteers,
  registered donors, collection stats, photos, expenses, revenue.
- **FR-CAMP-2 (M)** Collections at a camp link back to the camp for statistics.
- **FR-CAMP-3 (S)** Camp reminder notifications to registered donors.

### 3.13 Staff (STAFF)
- **FR-STAFF-1 (M)** Staff records, departments, role assignment.
- **FR-STAFF-2 (S)** Attendance, leaves, performance metrics, activity logs per staff.

### 3.14 Billing (BILL)
- **FR-BILL-1 (M)** Generate GST-compliant invoices on issue; line items per component.
- **FR-BILL-2 (M)** Record payments (cash/card/UPI/cheque), receipts, outstanding tracking.
- **FR-BILL-3 (M)** Expenses & income ledger; daily cash book; monthly financial report.
- **FR-BILL-4 (S)** Configurable processing-charge price list per component/group.

### 3.15 Reports (RPT)
- **FR-RPT-1 (M)** Daily/weekly/monthly/yearly reports for inventory, donors, collection,
  issue, lab, finance.
- **FR-RPT-2 (M)** Government/regulatory report templates.
- **FR-RPT-3 (M)** Export PDF, Excel, CSV; scheduled report generation via job queue.

### 3.16 Notifications (NOTI)
- **FR-NOTI-1 (M)** Channels: Email, SMS, WhatsApp (pluggable gateways).
- **FR-NOTI-2 (M)** Triggers: low stock, expiry, donor eligibility reminder, camp reminder,
  emergency request, request status change.
- **FR-NOTI-3 (M)** In-app notification centre with read/unread.

### 3.17 Settings (SET)
- **FR-SET-1 (M)** Organization & branch profile; users & permissions; theme.
- **FR-SET-2 (M)** Email/SMS/WhatsApp gateway credentials (encrypted at rest).
- **FR-SET-3 (S)** Backup & restore; data export.

### 3.18 Search & Analytics (SRCH/AN)
- **FR-SRCH-1 (M)** Global instant search across donors, patients, units, hospitals, requests.
- **FR-AN-1 (S)** Analytics: collection/demand trends, inventory heatmap, most-requested
  group, top hospitals, top donors, revenue & growth.
- **FR-AN-2 (C)** AI: low-stock prediction, demand forecasting, donor suggestions, report
  summarisation, natural-language search.

---

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | Performance | p95 API < 300 ms for reads; dashboard first paint < 2 s on broadband. |
| NFR-2 | Scalability | Stateless API horizontally scalable; jobs offloaded to queue; DB indexed for 1M+ units. |
| NFR-3 | Availability | Target 99.5%; graceful degradation if SMS/WhatsApp gateway down. |
| NFR-4 | Security | OWASP Top 10 hardening: JWT, hashed passwords, RBAC, input validation (zod), rate limiting, CSRF, XSS & SQLi protection (parametrised via Prisma), encrypted secrets. |
| NFR-5 | Auditability | Immutable audit log of who/what/when for all clinical & financial mutations. |
| NFR-6 | Data integrity | FK constraints, transactions for multi-row clinical operations, no orphan units. |
| NFR-7 | Usability | Keyboard shortcuts, auto-save, undo-delete, print-friendly views, mobile responsive. |
| NFR-8 | Maintainability | Modular monorepo, typed end-to-end, ≥70% test coverage on domain logic. |
| NFR-9 | Localisation | Configurable labels, currency, timezone, date format. |
| NFR-10 | Compliance | Retain clinical records ≥ statutory period; soft-delete + audit only. |

---

## 5. Domain Rules (Business Logic)

1. A unit cannot reach inventory without an **Approved** lab record.
2. A reactive TTI on any marker **permanently discards** the unit and flags the donor for
   review/deferral.
3. Issue requires: approved request **AND** compatible cross-match **AND** non-expired,
   non-reserved-for-other, available unit.
4. Reservation holds units for a specific request; expiry of the request releases them.
5. Donor next-eligible date is recomputed on every successful donation.
6. Expired units are swept daily and excluded from all available counts automatically.
7. Every state transition (unit, request, invoice) is recorded in the audit log.

---

## 6. Acceptance Criteria (samples)

- Registering a donor under 45 kg or under 18 blocks collection with a clear reason.
- A reactive HIV result moves the unit to Discarded and it never appears in inventory.
- Issuing without a compatible cross-match is rejected by the API (not just the UI).
- Monthly finance report totals reconcile with the sum of paid invoices minus expenses.
- Deleting a donor hides it but keeps history and offers a 10-second undo.

---

## 7. Assumptions & Dependencies
- SMTP, SMS and WhatsApp Business API credentials are provided by the bank.
- S3-compatible bucket is available for photos/report files.
- Single currency and timezone per branch (configurable).
