# User Flows — BloodLine

End-to-end flows for the core operations. Each flow names the role, the happy path and the
key guard rails (where the system blocks unsafe actions).

## 1. Authentication

```mermaid
flowchart TD
    A[Open app] --> B{Has valid session?}
    B -- yes --> H[Dashboard]
    B -- no --> C[Login: email + password]
    C --> D{Credentials ok?}
    D -- no --> C2[Show error, rate-limit, lockout after N]
    D -- yes --> E{MFA required for role?}
    E -- no --> H
    E -- yes --> F[Send OTP email/SMS] --> G[Enter OTP]
    G --> G2{OTP valid & unexpired?}
    G2 -- no --> G
    G2 -- yes --> H
    C -.Forgot password.-> R[Email reset link] --> R2[Set new password + OTP] --> C
```

## 2. The central blood lifecycle (collection → issue)

```mermaid
flowchart LR
    subgraph Reception/Collection
      D1[Register/find donor] --> D2{Eligible?}
      D2 -- no --> D3[Block + reason / Admin override]
      D2 -- yes --> C1[Create collection: bag#, volume, type, staff]
      C1 --> C2[Unit = COLLECTED + auto Lab record PENDING]
    end
    subgraph Lab
      C2 --> L1[Run TTI + typing + crossmatch readiness]
      L1 --> L2{Any reactive?}
      L2 -- yes --> L3[Unit QUARANTINED → DISCARDED, flag donor]
      L2 -- no --> L4[Doctor verify → Unit APPROVED]
    end
    subgraph Components/Inventory
      L4 --> P1[Separate into PRBC/FFP/Platelets/Cryo]
      P1 --> P2[Each: barcode, expiry, location → AVAILABLE]
      P2 --> P3[inventory_stock counters ++ ]
    end
    subgraph Request/Issue
      Q1[Hospital/Emergency request] --> Q2{Doctor approve?}
      Q2 -- no --> Q3[Rejected]
      Q2 -- yes --> Q4[Reserve matching units]
      Q4 --> X1[Cross-match patient sample]
      X1 --> X2{Compatible & unit valid?}
      X2 -- no --> X3[Block issue]
      X2 -- yes --> X4[Issue: scan, FEFO, decrement stock]
      X4 --> X5[Generate issue slip + draft invoice]
    end
    P3 -.matches.-> Q4
```

**Guard rails enforced server-side:** ineligible donor blocks collection; reactive TTI
discards the unit and it can never enter inventory; issue is impossible without an approved
request, a compatible cross-match, and a valid (approved, non-expired, not reserved-for-
other) unit.

## 3. Donor registration & donation (Reception → Collection Staff)

```mermaid
flowchart TD
    A[Reception: search by mobile/govt-id] --> B{Exists?}
    B -- yes --> C[Open donor, check next_eligible_at]
    B -- no --> D[Create donor + photo + consent questionnaire]
    C --> E{Eligible today?}
    D --> E
    E -- no --> F[Show next eligible date / deferral]
    E -- yes --> G[Collection staff records donation]
    G --> H[Recompute donation_count, last/next eligible]
    H --> I[Print donor card with QR]
```

## 4. Blood request → approval → fulfilment (Hospital/Doctor/Store)

```mermaid
flowchart TD
    A[Request created: channel, priority, group, component, units, required_by]
    A --> B{Priority critical?}
    B -- yes --> N[Dashboard alert + notify on-call]
    B -- no --> C[Enter request queue]
    N --> D[Doctor reviews]
    C --> D
    D --> E{Approve?}
    E -- no --> F[Reject + reason → notify requester]
    E -- yes --> G[Reserve units up to availability]
    G --> H{Enough stock?}
    H -- no --> I[Partial reserve + low-stock/recall alert]
    H -- yes --> J[Ready for cross-match & issue]
```

## 5. Issue & billing (Reception/Store → Accountant)

```mermaid
flowchart TD
    A[Open approved request] --> B[Verify cross-match COMPATIBLE]
    B --> C[Scan unit barcodes; FEFO suggestion]
    C --> D{All units valid & reserved-for-this?}
    D -- no --> E[Reject scan, explain]
    D -- yes --> F[Confirm issue in one transaction]
    F --> G[Components → ISSUED, stock--, reservation consumed]
    G --> H[Issue slip PDF]
    H --> I[Draft invoice from price list + GST]
    I --> J[Accountant records payment idempotently]
    J --> K[Update invoice status + hospital outstanding]
```

## 6. Camp lifecycle (Admin/Collection Staff)

```mermaid
flowchart TD
    A[Create upcoming camp: location, date, organizer] --> B[Register donors + volunteers]
    B --> C[Send camp reminders SMS/WA]
    C --> D[On camp day: collections linked to camp]
    D --> E[Units flow into standard lab→component pipeline]
    E --> F[Record expenses + revenue]
    F --> G[Camp closes → statistics + report + photos]
```

## 7. Expiry & low-stock automation (system jobs)

```mermaid
flowchart TD
    A[Nightly expiry sweep job] --> B[Find components past expires_at]
    B --> C[Set EXPIRED, movement EXPIRE, stock--]
    C --> D[Notify Store Manager]
    E[On every movement / hourly check] --> F{group×component below threshold?}
    F -- yes --> G[Low-stock alert + optional donor recall campaign]
    H[Reservation sweep] --> I[Release reservations past expires_at → stock available]
```

## 8. Look-back / recall (Doctor/Admin — safety)

```mermaid
flowchart TD
    A[Donor later tests reactive / reports illness] --> B[Open donor → look-back]
    B --> C[Trace all prior units → components → issues → recipients]
    C --> D[Quarantine in-stock related components]
    D --> E[Notify hospitals/patients of affected issued units]
    E --> F[Record recall outcome in audit log]
```

## 9. Role landing & access

| Role | Lands on | Primary daily flow |
|------|----------|--------------------|
| Super Admin / Admin | Dashboard | oversight, approvals, settings |
| Doctor | Requests queue | approve requests, verify lab/cross-match, look-back |
| Lab Technician | Lab worklist | TTI, typing, cross-match, component QA |
| Reception | Donors / Requests | register, intake, request entry, print cards |
| Data Entry | Imports | bulk capture & corrections |
| Accountant | Billing | invoices, payments, finance reports |
| Collection Staff | Collection | phlebotomy records, camp collection |
| Store Manager | Inventory | stock, expiry, discards, transfers |

Every flow writes an **audit_log** entry; every blocked action shows a clear,
human-readable reason.
