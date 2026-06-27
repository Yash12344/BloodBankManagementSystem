# UI Wireframes & Design System — BloodLine

Premium dashboard in the spirit of Stripe / Linear / Vercel: white canvas, red accent,
generous whitespace, rounded cards, soft shadows, crisp typography, fast micro-animations.

## 1. Design tokens

```
Color
  --bg            #FFFFFF   (dark: #0B0B0C)
  --surface       #FFFFFF   (dark: #141416)
  --surface-2     #F7F7F8   (dark: #1C1C1F)
  --border        #EAEAEC   (dark: #27272A)
  --text          #18181B   (dark: #FAFAFA)
  --text-muted    #71717A
  --accent        #E53935   (primary red)
  --accent-hover  #C62828
  --accent-soft   #FDECEA   (tint for backgrounds/badges)
  --success       #16A34A   --warning #F59E0B   --critical #DC2626   --info #2563EB

Radius     card 16px · control 10px · pill 999px
Shadow     sm 0 1 2 / 0.04   ·  md 0 4 12 / 0.06   ·  lg 0 12 32 / 0.10
Type       Inter / Geist. Display 32/600, H1 24/600, H2 18/600, Body 14/400, Caption 12/500
Spacing    4-pt scale (4,8,12,16,24,32,48)
Motion     150–200ms ease-out; spring on overlays (Framer Motion)
```

Blood-group / component badges use a fixed colour map; inventory cells are colour-coded
critical(red) / low(amber) / ok(green).

## 2. App shell

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ┌────────────┐  ┌──────────────────────────────────────────────────────────┐  │
│ │  BloodLine │  │  ⌘K  Search donors, units, hospitals…        🔔  ◐  ⚙  👤  │  │
│ │  ● Branch  │  └──────────────────────────────────────────────────────────┘  │
│ ├────────────┤  ┌──────────────────────────────────────────────────────────┐  │
│ │ ⌂ Dashboard│  │                                                          │  │
│ │ ♥ Donors   │  │                    PAGE CONTENT                           │  │
│ │ ⊕ Collection│ │                                                          │  │
│ │ ⚗ Lab      │  │                                                          │  │
│ │ ⬡ Components│ │                                                          │  │
│ │ ▦ Inventory│  │                                                          │  │
│ │ ⛑ Patients │  │                                                          │  │
│ │ ⇄ Requests │  │                                                          │  │
│ │ ⤓ Issue    │  │                                                          │  │
│ │ ⌘ Hospitals│  │                                                          │  │
│ │ ⛺ Camps    │  │                                                          │  │
│ │ ⏱ Staff    │  │                                                          │  │
│ │ ₹ Billing  │  │                                                          │  │
│ │ ▤ Reports  │  │                                                          │  │
│ │ ⚙ Settings │  │                                                          │  │
│ └────────────┘  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
Collapsible sidebar (icon-only on tablet). Topbar: command palette, notifications,
dark-mode toggle, settings, profile menu. Sidebar items hidden if role lacks permission.
```

## 3. Login

```
┌───────────────────────────────┬───────────────────────────────┐
│                               │   ♥ BloodLine                 │
│      [ Brand panel /          │   Welcome back                │
│        gradient red art ]     │   ┌─────────────────────────┐ │
│                               │   │ Email                   │ │
│   "Run your blood bank        │   └─────────────────────────┘ │
│    without paperwork."        │   ┌─────────────────────────┐ │
│                               │   │ Password            👁  │ │
│                               │   └─────────────────────────┘ │
│                               │   Forgot password?            │
│                               │   [   Sign in  →  ]  (red)    │
│                               │   ─── then OTP step if on ─── │
└───────────────────────────────┴───────────────────────────────┘
OTP screen: 6 segmented inputs, resend timer, auto-advance.
```

## 4. Dashboard

```
Today                                                   [ + Quick action ▾ ]
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Collection│ │ Issued   │ │ Requests │ │Emergency │ │Pending   │ │ Revenue  │
│   24 ▲12%│ │   18     │ │   31     │ │   3  🔴  │ │ tests 9  │ │ ₹42,300  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
┌───────────────────────────────────────┐ ┌─────────────────────────────────┐
│  Weekly collection (area chart)        │ │  Inventory by group (bars)      │
│   ╱╲    ╱╲                              │ │  A+ ██████  O+ █████████        │
│  ╱  ╲__╱  ╲___                         │ │  B+ ████    AB+ ██   O- ███     │
└───────────────────────────────────────┘ └─────────────────────────────────┘
┌───────────────────────────────────────┐ ┌─────────────────────────────────┐
│  Units expiring ≤ 7 days   (list)      │ │  Recent activity (timeline)     │
│  • PRBC O+  #B2381  in 2d   [reserve]  │ │  10:24 Issued 2× PRBC to Apollo │
│  • FFP A+   #B2390  in 5d              │ │  10:02 Lab approved #B2381      │
└───────────────────────────────────────┘ │  09:40 Donor R. Mehta collected │
                                           └─────────────────────────────────┘
Demand by group · Component distribution donut · Camp stats card below.
KPI set & charts vary by role (Accountant sees revenue first; Store Manager sees expiry).
```

## 5. Module list pattern (Donors / Requests / Inventory etc.)

```
Donors                                   [ Import ] [ Export ] [ + Add donor ]
┌──────────────────────────────────────────────────────────────────────────┐
│ 🔍 Search   │ Group ▾ │ Eligibility ▾ │ Location ▾ │ Saved views ▾        │
├────┬────────────────┬───────┬──────────┬──────────────┬─────────┬─────────┤
│ ☐  │ Donor          │ Group │ Last don.│ Next eligible│ Status  │  ⋯      │
├────┼────────────────┼───────┼──────────┼──────────────┼─────────┼─────────┤
│ ☐  │ 🧑 R. Mehta D041│ O+   │ 12 Mar   │ ✅ Eligible  │ Active  │ ⋯       │
│ ☐  │ 🧑 S. Iyer D042 │ B-   │ 02 Jun   │ ⏳ 14 Jun    │ Active  │ ⋯       │
└────┴────────────────┴───────┴──────────┴──────────────┴─────────┴─────────┘
   Rows: 1–25 of 1,204            ‹ 1 2 3 … ›     bulk bar appears on select
Row click → right-side detail drawer (profile, history, donate, print card).
```

## 6. Detail drawer (Donor)

```
                                   ┌───────────────────────────────────┐
                                   │ 🧑 Rohit Mehta    O+    ✦ Eligible │
                                   │ D041 · 32y · M · 72kg             │
                                   │ 📞 98xxxxxx · ✉ rohit@…           │
                                   │ ─────────────────────────────────│
                                   │ [ Donate ] [ Edit ] [ Card ▾ ] ⋯ │
                                   │ Tabs: Overview·History·Tests·Docs │
                                   │ Donation history (timeline)       │
                                   │  • 12 Mar  PRBC,FFP  #B2381  ✅   │
                                   │  • 01 Dec  Whole      #B1190 ✅   │
                                   └───────────────────────────────────┘
```

## 7. Collection → Lab → Components (operational flow screens)

```
New collection                              Lab worklist                Separate components
┌───────────────────────┐   ┌──────────────────────────────┐  ┌──────────────────────────┐
│ Donor  [search ▾]     │   │ Unit   Group  HB  TTI   ⋯     │  │ Unit #B2381  O+          │
│ Group  O+ (auto)      │   │ B2381  O+    13  ▢ run tests  │  │ Split into:              │
│ Volume 450ml          │   │ B2382  A+    12  ✅ approved   │  │ ☑ PRBC  ☑ FFP            │
│ Type   ⦿Volunteer     │   │ B2383  B-    14  ⛔ reactive   │  │ ☐ Platelets ☐ Cryo       │
│ Source ⦿Walk-in       │   └──────────────────────────────┘  │ Location  Fridge-2 / R3  │
│ Staff  [me]           │   TTI panel: HIV/HBsAg/HCV/Mal/Syph │ Barcodes auto-generated  │
│ [ Eligibility ✅ Save]│   each Reactive/Non-reactive + sign │ [ Separate → inventory ] │
└───────────────────────┘   └────────────────────────────────┘  └──────────────────────────┘
```

## 8. Inventory grid (colour-coded)

```
Inventory                                            [ Heatmap ] [ Export ]
        Whole   PRBC   Platelets  FFP    Cryo
 A+      6🟢     14🟢    2🟡        9🟢    1🟡
 A-      1🔴     3🟡     0🔴        2🟡    0🔴
 B+      4🟢     11🟢    3🟢        7🟢    2🟡
 O-      0🔴     2🔴     1🔴        1🔴    0🔴   ← critical row glows
Cell → drawer lists individual units (bag, expiry, location, status, reserve/discard).
```

## 9. Requests & Issue

```
Requests (kanban or table)                         Issue blood
┌─Pending─┐┌─Approved─┐┌─Completed─┐    ┌─────────────────────────────────┐
│ #R-204  ││ #R-198   ││ #R-180    │    │ Request #R-198  Apollo · O+     │
│ Apollo  ││ City Hosp││ …         │    │ Patient: Mrs. Rao               │
│ O+ ×2 🔴││ A+ ×1    ││           │    │ Cross-match: ✅ Compatible      │
│[approve]││[issue →] ││           │    │ Scan units: [▮▮▮ #B2381] [+]    │
└─────────┘└──────────┘└───────────┘    │ FEFO suggests #B2381 (exp 2d)   │
Critical requests pinned + red.          │ [ Confirm issue → invoice ]     │
                                         └─────────────────────────────────┘
```

## 10. Billing, Reports, Settings (patterns)

- **Billing**: invoice list (status pills) → invoice detail with line items, GST summary,
  payment drawer (method, amount, idempotent), receipt PDF, hospital outstanding panel.
- **Reports**: pick type + range → preview table/chart → export PDF/Excel/CSV; scheduled
  reports list.
- **Settings**: tabbed (Organization · Branches · Users & Roles · Permissions matrix ·
  Gateways · Theme · Backup). Permission matrix is a role × module grid of checkboxes.

## 11. Responsive & states

- **Desktop** full sidebar + multi-column. **Tablet** icon sidebar, 2-col. **Mobile**
  bottom nav + stacked cards; tables collapse to cards; drawers become full-screen sheets.
- Every list/table has explicit **loading (skeleton)**, **empty (illustration + CTA)** and
  **error (retry)** states. Destructive actions show confirm + undo toast.
- Command palette (⌘K), keyboard shortcuts (`g d` dashboard, `n` new, `/` search), and
  toast notifications are global.
