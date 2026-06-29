/**
 * BloodLine — database seed.
 * Idempotent: safe to run repeatedly. Seeds the permission catalogue, the default
 * role→permission matrix, a demo organization + branch, and a Super Admin user.
 *
 * Usage: pnpm db:seed (loads the root .env automatically; no manual exports needed)
 */
// Must run before `process.env` is read: loads the monorepo root `.env`.
import "../src/loadEnv.js";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

// Default Super Admin credentials for first login. Override via env; rotate immediately.
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@bloodline.local";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!123";

// Modules and the actions each supports. The permission catalogue is the cartesian
// product, plus a few module-specific actions (approve/export).
const MODULES = [
  "dashboard",
  "donors",
  "collection",
  "lab",
  "components",
  "inventory",
  "patients",
  "requests",
  "issue",
  "hospitals",
  "camps",
  "staff",
  "billing",
  "reports",
  "notifications",
  "analytics",
  "settings",
] as const;

const BASE_ACTIONS = ["view", "create", "edit", "delete"] as const;
const EXTRA_ACTIONS: Record<string, string[]> = {
  lab: ["approve"],
  requests: ["approve"],
  issue: ["approve"],
  billing: ["export"],
  reports: ["export"],
  donors: ["export", "import"],
  settings: ["manage"],
};

// Default permission grants per role, expressed as `module.action` or `module.*`.
const ROLE_MATRIX: Record<string, string[]> = {
  "Super Admin": ["*.*"],
  Admin: [
    "dashboard.*",
    "donors.*",
    "collection.*",
    "lab.*",
    "components.*",
    "inventory.*",
    "patients.*",
    "requests.*",
    "issue.*",
    "hospitals.*",
    "camps.*",
    "staff.*",
    "billing.*",
    "reports.*",
    "notifications.*",
    "analytics.*",
    "settings.view",
  ],
  Doctor: [
    "dashboard.view",
    "donors.view",
    "lab.view",
    "lab.approve",
    "patients.*",
    "requests.view",
    "requests.approve",
    "requests.edit",
    "issue.view",
    "issue.approve",
    "reports.view",
    "analytics.view",
  ],
  "Lab Technician": [
    "dashboard.view",
    "lab.*",
    "components.*",
    "inventory.view",
    "requests.view",
  ],
  Reception: [
    "dashboard.view",
    "donors.*",
    "collection.create",
    "collection.view",
    "patients.*",
    "requests.create",
    "requests.view",
    "issue.view",
    "issue.create",
    "hospitals.view",
  ],
  "Data Entry": [
    "dashboard.view",
    "donors.create",
    "donors.edit",
    "donors.import",
    "patients.create",
    "patients.edit",
  ],
  Accountant: [
    "dashboard.view",
    "billing.*",
    "hospitals.view",
    "reports.view",
    "reports.export",
    "analytics.view",
  ],
  "Blood Collection Staff": [
    "dashboard.view",
    "donors.view",
    "collection.*",
    "camps.view",
  ],
  "Store Manager": [
    "dashboard.view",
    "inventory.*",
    "components.*",
    "issue.view",
    "issue.create",
    "reports.view",
  ],
};

function expandActions(module: string): string[] {
  return [...BASE_ACTIONS, ...(EXTRA_ACTIONS[module] ?? [])];
}

// ---------------------------------------------------------------------------------------
// Demo data: a realistic end-to-end slice of the operation so the app is populated and
// every screen (collection, lab, inventory, requests, issue, billing, camps, staff,
// dashboard, analytics) shows meaningful numbers on first run.
// ---------------------------------------------------------------------------------------
async function seedDemo(db: PrismaClient, branchId: string, adminId: string, staffPasswordHash: string) {
  const day = 86_400_000;
  const now = new Date();
  const addDays = (base: Date, days: number) => new Date(base.getTime() + days * day);
  const dateOnly = (d: Date) => new Date(d.toISOString().slice(0, 10));
  const year = now.getUTCFullYear();

  // --- Staff: one user per operational role (same default password as admin) ---
  const roleByName = Object.fromEntries((await db.role.findMany()).map((r) => [r.name, r.id] as const));
  const staffDefs = [
    { name: "Dr. Anita Kumar", email: "doctor@bloodline.local", role: "Doctor", department: "Clinical", designation: "Consultant Haematologist" },
    { name: "Ravi Sharma", email: "lab@bloodline.local", role: "Lab Technician", department: "Laboratory", designation: "Senior Technician" },
    { name: "Priya Menon", email: "reception@bloodline.local", role: "Reception", department: "Front Office", designation: "Receptionist" },
    { name: "Sahil Jain", email: "accounts@bloodline.local", role: "Accountant", department: "Finance", designation: "Accountant" },
    { name: "Neha Bansal", email: "store@bloodline.local", role: "Store Manager", department: "Inventory", designation: "Store In-charge" },
  ] as const;

  const staff: Record<string, string> = {};
  for (const s of staffDefs) {
    const user = await db.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        branchId,
        roleId: roleByName[s.role]!,
        name: s.name,
        email: s.email,
        passwordHash: staffPasswordHash,
        status: "ACTIVE",
        staffProfile: { create: { department: s.department, designation: s.designation, joinDate: addDays(now, -200) } },
      },
      include: { staffProfile: true },
    });
    staff[s.role] = user.id;
    if (user.staffProfile) {
      await db.attendance.create({
        data: { staffId: user.staffProfile.id, date: dateOnly(now), status: "PRESENT", checkIn: new Date(now.getTime() - 4 * 3_600_000) },
      });
      if (s.role === "Lab Technician") {
        await db.leaveRequest.create({
          data: { staffId: user.staffProfile.id, fromDate: dateOnly(addDays(now, 10)), toDate: dateOnly(addDays(now, 12)), type: "CASUAL", reason: "Family function", status: "PENDING" },
        });
      }
    }
  }

  // --- Donors (across all groups; two left without donations for variety) ---
  const donorDefs = [
    { name: "Rohit Mehta", gender: "MALE", bloodGroup: "O_POS", weightKg: 72, mobile: "9800000001", dob: new Date("1992-02-11"), occupation: "Engineer", address: "12 MG Road" },
    { name: "Sunita Iyer", gender: "FEMALE", bloodGroup: "B_NEG", weightKg: 58, mobile: "9800000002", dob: new Date("1990-07-02"), occupation: "Teacher", address: "44 Park Street" },
    { name: "Arjun Rao", gender: "MALE", bloodGroup: "A_POS", weightKg: 80, mobile: "9800000003", dob: new Date("1988-11-20"), occupation: "Architect", address: "9 Lake View" },
    { name: "Meera Nair", gender: "FEMALE", bloodGroup: "AB_POS", weightKg: 63, mobile: "9800000004", dob: new Date("1995-05-15"), occupation: "Designer", address: "7 Hill Road" },
    { name: "Vikram Singh", gender: "MALE", bloodGroup: "O_NEG", weightKg: 75, mobile: "9800000005", dob: new Date("1985-01-30"), occupation: "Pilot", address: "21 Airport Rd" },
    { name: "Priya Sharma", gender: "FEMALE", bloodGroup: "A_POS", weightKg: 60, mobile: "9800000006", dob: new Date("1993-09-12"), occupation: "Nurse", address: "3 Garden Lane" },
    { name: "Karan Malhotra", gender: "MALE", bloodGroup: "B_POS", weightKg: 78, mobile: "9800000007", dob: new Date("1991-03-25"), occupation: "Banker", address: "88 Sea Face" },
    { name: "Anjali Desai", gender: "FEMALE", bloodGroup: "O_POS", weightKg: 56, mobile: "9800000008", dob: new Date("1996-12-01"), occupation: "Student", address: "5 College Rd" },
    { name: "Suresh Gupta", gender: "MALE", bloodGroup: "A_NEG", weightKg: 82, mobile: "9800000009", dob: new Date("1983-06-18"), occupation: "Shopkeeper", address: "14 Market St" },
    { name: "Fatima Khan", gender: "FEMALE", bloodGroup: "AB_NEG", weightKg: 61, mobile: "9800000010", dob: new Date("1994-08-09"), occupation: "Pharmacist", address: "27 Old Town" },
    { name: "Deepak Verma", gender: "MALE", bloodGroup: "O_POS", weightKg: 70, mobile: "9800000011", dob: new Date("1989-04-22"), occupation: "Driver", address: "19 Transport Nagar" },
    { name: "Neha Joshi", gender: "FEMALE", bloodGroup: "B_POS", weightKg: 59, mobile: "9800000012", dob: new Date("1997-10-05"), occupation: "Analyst", address: "33 Tech Park" },
  ] as const;

  const donors: { id: string; bloodGroup: string; gender: string }[] = [];
  let dn = 1;
  for (const d of donorDefs) {
    const donor = await db.donor.create({
      data: { branchId, donorCode: `D${String(dn++).padStart(5, "0")}`, ...d },
    });
    donors.push(donor);
  }

  // --- Hospitals + doctors + patients ---
  const h1 = await db.hospital.create({ data: { branchId, name: "City General Hospital", address: "Civil Lines", phone: "04022220000", email: "info@citygeneral.local", gstin: "29ABCDE1234F1Z5", creditLimitMinor: 5_000_00 } });
  const h2 = await db.hospital.create({ data: { branchId, name: "Sunrise Multispeciality", address: "Sector 22", phone: "04033330000", email: "contact@sunrise.local", gstin: "29ZYXWV9876P1Z2", creditLimitMinor: 3_000_00 } });
  const h3 = await db.hospital.create({ data: { branchId, name: "Apollo Emergency Care", address: "Ring Road", phone: "04044440000", email: "er@apollo.local", creditLimitMinor: 10_000_00 } });

  const docA = await db.hospitalDoctor.create({ data: { hospitalId: h1.id, name: "Dr. S. Reddy", specialization: "Haematology", regNo: "MH-12345" } });
  await db.hospitalDoctor.create({ data: { hospitalId: h2.id, name: "Dr. P. Banerjee", specialization: "Oncology", regNo: "MH-22456" } });
  const docC = await db.hospitalDoctor.create({ data: { hospitalId: h3.id, name: "Dr. K. Iyer", specialization: "Emergency Medicine", regNo: "MH-33567" } });

  const pat1 = await db.patient.create({ data: { branchId, hospitalId: h1.id, doctorId: docA.id, name: "Ramesh Patil", age: 54, gender: "MALE", bloodGroup: "A_POS", diagnosis: "Anaemia" } });
  const pat2 = await db.patient.create({ data: { branchId, hospitalId: h2.id, name: "Lata Bose", age: 47, gender: "FEMALE", bloodGroup: "O_POS", diagnosis: "Post-surgical" } });
  const pat3 = await db.patient.create({ data: { branchId, hospitalId: h1.id, doctorId: docA.id, name: "Imran Sheikh", age: 33, gender: "MALE", bloodGroup: "O_NEG", diagnosis: "Trauma" } });
  const pat4 = await db.patient.create({ data: { branchId, hospitalId: h3.id, doctorId: docC.id, name: "Geeta Rao", age: 29, gender: "FEMALE", bloodGroup: "B_POS", diagnosis: "Obstetric haemorrhage" } });
  const pat5 = await db.patient.create({ data: { branchId, hospitalId: h1.id, name: "Mohan Das", age: 61, gender: "MALE", bloodGroup: "O_POS", diagnosis: "Liver disease" } });

  // --- Camps ---
  const campDone = await db.camp.create({
    data: {
      branchId, name: "Tech Park Mega Drive", location: "Cyber City", scheduledDate: addDays(now, -15), status: "COMPLETED", organizer: "Rotary Club",
      volunteers: { create: [{ name: "Asha", role: "Coordinator", phone: "9811111111" }, { name: "Ramesh", role: "Logistics", phone: "9822222222" }] },
      expenses: { create: [{ head: "Refreshments", amountMinor: 8_000_00 }, { head: "Tents & chairs", amountMinor: 5_000_00 }] },
    },
  });
  await db.camp.create({ data: { branchId, name: "University Blood Donation Week", location: "State University", scheduledDate: addDays(now, 14), status: "UPCOMING", organizer: "NSS Unit" } });

  // --- Collection → lab → component pipeline -------------------------------------------
  const compMeta: Record<string, { days: number; temp: string; loc: string; vol: number }> = {
    WHOLE_BLOOD: { days: 35, temp: "2-6°C", loc: "Cold Room A", vol: 450 },
    PRBC: { days: 42, temp: "2-6°C", loc: "Cold Room A", vol: 250 },
    PLATELETS: { days: 5, temp: "20-24°C", loc: "Agitator 1", vol: 50 },
    FFP: { days: 365, temp: "≤ -30°C", loc: "Plasma Freezer 1", vol: 200 },
    CRYO: { days: 365, temp: "≤ -30°C", loc: "Plasma Freezer 2", vol: 30 },
  };
  let bagSeq = 1;
  let barcodeSeq = 1;

  type CompSpec = { type: string; status: string; expDays?: number };
  async function makeDonation(opts: {
    donor: { id: string; bloodGroup: string; gender: string };
    collectedAt: Date;
    source: string;
    campId?: string;
    lab: "APPROVED" | "PENDING" | "REACTIVE";
    components?: CompSpec[];
  }) {
    const approved = opts.lab === "APPROVED";
    const reactive = opts.lab === "REACTIVE";
    const donation = await db.donation.create({
      data: {
        branchId, donorId: opts.donor.id, campId: opts.campId ?? null, collectedByUserId: staff["Reception"],
        donationType: "VOLUNTARY", source: opts.source, collectedAt: opts.collectedAt, volumeMl: 450,
        status: approved ? "COMPLETED" : reactive ? "REJECTED" : "PROCESSING",
      },
    });
    const unit = await db.bloodUnit.create({
      data: {
        branchId, donationId: donation.id, bagNumber: `BG-${String(bagSeq++).padStart(6, "0")}`,
        bloodGroup: opts.donor.bloodGroup as never, volumeMl: 450,
        status: approved ? "SEPARATED" : reactive ? "QUARANTINED" : "PROCESSING",
      },
    });
    await db.labTest.create({
      data: {
        unitId: unit.id, hb: 13.2,
        hiv: reactive ? "REACTIVE" : approved ? "NON_REACTIVE" : "PENDING",
        hbsag: approved || reactive ? "NON_REACTIVE" : "PENDING",
        hcv: approved || reactive ? "NON_REACTIVE" : "PENDING",
        malaria: approved || reactive ? "NON_REACTIVE" : "PENDING",
        syphilis: approved || reactive ? "NON_REACTIVE" : "PENDING",
        result: approved ? "APPROVED" : reactive ? "REJECTED" : "PENDING",
        approvedAt: approved ? addDays(opts.collectedAt, 1) : null,
        testedByUserId: staff["Lab Technician"],
        verifiedByUserId: approved ? staff["Doctor"] : null,
        comments: reactive ? "Reactive for HIV on initial screening" : null,
      },
    });
    const components: { id: string; type: string; bloodGroup: string; status: string }[] = [];
    for (const c of opts.components ?? []) {
      const meta = compMeta[c.type]!;
      const prepared = addDays(opts.collectedAt, 1);
      const comp = await db.bloodComponent.create({
        data: {
          branchId, unitId: unit.id, type: c.type as never, bloodGroup: opts.donor.bloodGroup as never,
          barcode: `CMP-${String(barcodeSeq++).padStart(6, "0")}`, volumeMl: meta.vol,
          storageTemp: meta.temp, storageLocation: meta.loc, preparedAt: prepared,
          expiresAt: addDays(prepared, c.expDays ?? meta.days), status: c.status as never,
        },
      });
      components.push(comp);
    }
    await db.donor.update({
      where: { id: opts.donor.id },
      data: { donationCount: { increment: 1 }, lastDonationAt: opts.collectedAt, nextEligibleAt: addDays(opts.collectedAt, opts.donor.gender === "FEMALE" ? 120 : 90) },
    });
    if (reactive) {
      await db.donor.update({ where: { id: opts.donor.id }, data: { status: "BLACKLISTED" } });
      await db.deferral.create({ data: { donorId: opts.donor.id, type: "PERMANENT", reason: "Reactive TTI screening (HIV)", byUserId: staff["Lab Technician"] } });
    }
    return { donation, unit, components };
  }

  const pick = (comps: { type: string }[], type: string) => comps.find((c) => c.type === type)!;

  const r1 = await makeDonation({ donor: donors[0]!, collectedAt: addDays(now, -30), source: "WALK_IN", lab: "APPROVED", components: [{ type: "PRBC", status: "ISSUED" }, { type: "FFP", status: "AVAILABLE" }] });
  const r2 = await makeDonation({ donor: donors[1]!, collectedAt: addDays(now, -28), source: "WALK_IN", lab: "APPROVED", components: [{ type: "PRBC", status: "AVAILABLE" }, { type: "FFP", status: "AVAILABLE" }] });
  const r3 = await makeDonation({ donor: donors[2]!, collectedAt: addDays(now, -25), source: "WALK_IN", lab: "APPROVED", components: [{ type: "PRBC", status: "ISSUED" }, { type: "FFP", status: "AVAILABLE" }] });
  const r4 = await makeDonation({ donor: donors[3]!, collectedAt: addDays(now, -20), source: "WALK_IN", lab: "APPROVED", components: [{ type: "PRBC", status: "AVAILABLE" }, { type: "PLATELETS", status: "AVAILABLE", expDays: 2 }] });
  const r5 = await makeDonation({ donor: donors[4]!, collectedAt: addDays(now, -12), source: "WALK_IN", lab: "APPROVED", components: [{ type: "PRBC", status: "RESERVED" }, { type: "FFP", status: "AVAILABLE" }] });
  await makeDonation({ donor: donors[5]!, collectedAt: addDays(now, -10), source: "WALK_IN", lab: "APPROVED", components: [{ type: "PRBC", status: "AVAILABLE" }, { type: "FFP", status: "AVAILABLE" }] });
  const r6 = await makeDonation({ donor: donors[5]!, collectedAt: addDays(now, -9), source: "HOSPITAL", lab: "APPROVED", components: [{ type: "PRBC", status: "ISSUED" }] });
  await makeDonation({ donor: donors[6]!, collectedAt: addDays(now, -8), source: "CAMP", campId: campDone.id, lab: "APPROVED", components: [{ type: "PRBC", status: "AVAILABLE" }, { type: "FFP", status: "AVAILABLE" }] });
  await makeDonation({ donor: donors[7]!, collectedAt: addDays(now, -3), source: "WALK_IN", lab: "PENDING" });
  await makeDonation({ donor: donors[8]!, collectedAt: addDays(now, -2), source: "CAMP", campId: campDone.id, lab: "PENDING" });
  await makeDonation({ donor: donors[9]!, collectedAt: addDays(now, -2), source: "WALK_IN", lab: "REACTIVE" });

  // --- Requests → reserve → cross-match → issue → invoice → payment --------------------
  // Completed #1: A_POS PRBC ×2 → fully paid (City General).
  const a1 = pick(r3.components, "PRBC");
  const a2 = pick(r6.components, "PRBC");
  const req1 = await db.bloodRequest.create({ data: { branchId, patientId: pat1.id, hospitalId: h1.id, doctorId: docA.id, channel: "HOSPITAL", priority: "NORMAL", bloodGroup: "A_POS", componentType: "PRBC", unitsRequested: 2, status: "COMPLETED", approvedByUserId: staff["Doctor"], createdAt: addDays(now, -6) } });
  for (const c of [a1, a2]) await db.reservation.create({ data: { requestId: req1.id, componentId: c.id, status: "CONSUMED" } });
  const xm1 = await db.crossMatch.create({ data: { requestId: req1.id, componentId: a1.id, result: "COMPATIBLE", technicianId: staff["Lab Technician"], patientSampleRef: "S-1001" } });
  const xm2 = await db.crossMatch.create({ data: { requestId: req1.id, componentId: a2.id, result: "COMPATIBLE", technicianId: staff["Lab Technician"], patientSampleRef: "S-1002" } });
  const issue1 = await db.issue.create({ data: { branchId, requestId: req1.id, patientId: pat1.id, hospitalId: h1.id, issuedByUserId: staff["Reception"], status: "ISSUED", issuedAt: addDays(now, -5) } });
  await db.issueItem.create({ data: { issueId: issue1.id, componentId: a1.id, crossMatchId: xm1.id, priceMinor: 1_300_00 } });
  await db.issueItem.create({ data: { issueId: issue1.id, componentId: a2.id, crossMatchId: xm2.id, priceMinor: 1_300_00 } });
  await db.issue.update({ where: { id: issue1.id }, data: { slipUrl: `/api/v1/issues/${issue1.id}/slip` } });
  const inv1 = await db.invoice.create({
    data: {
      branchId, issueId: issue1.id, hospitalId: h1.id, patientId: pat1.id, number: `INV-${year}-00001`, status: "PAID",
      subtotalMinor: 2_600_00, gstMinor: 130_00, totalMinor: 2_730_00, balanceMinor: 0, issuedAt: addDays(now, -5),
      lines: { create: [
        { description: "PRBC A_POS", qty: 1, unitPriceMinor: 1_300_00, gstRate: 5, amountMinor: 1_300_00 },
        { description: "PRBC A_POS", qty: 1, unitPriceMinor: 1_300_00, gstRate: 5, amountMinor: 1_300_00 },
      ] },
    },
  });
  await db.payment.create({ data: { invoiceId: inv1.id, method: "BANK", amountMinor: 2_730_00, idempotencyKey: randomUUID(), receivedByUserId: staff["Accountant"], reference: "NEFT-778812" } });

  // Completed #2: O_POS PRBC ×1 → part-paid (Sunrise carries a balance).
  const o1 = pick(r1.components, "PRBC");
  const req2 = await db.bloodRequest.create({ data: { branchId, patientId: pat2.id, hospitalId: h2.id, channel: "HOSPITAL", priority: "NORMAL", bloodGroup: "O_POS", componentType: "PRBC", unitsRequested: 1, status: "COMPLETED", approvedByUserId: staff["Doctor"], createdAt: addDays(now, -4) } });
  await db.reservation.create({ data: { requestId: req2.id, componentId: o1.id, status: "CONSUMED" } });
  const xm3 = await db.crossMatch.create({ data: { requestId: req2.id, componentId: o1.id, result: "COMPATIBLE", technicianId: staff["Lab Technician"], patientSampleRef: "S-2001" } });
  const issue2 = await db.issue.create({ data: { branchId, requestId: req2.id, patientId: pat2.id, hospitalId: h2.id, issuedByUserId: staff["Reception"], status: "ISSUED", issuedAt: addDays(now, -3) } });
  await db.issueItem.create({ data: { issueId: issue2.id, componentId: o1.id, crossMatchId: xm3.id, priceMinor: 1_300_00 } });
  await db.issue.update({ where: { id: issue2.id }, data: { slipUrl: `/api/v1/issues/${issue2.id}/slip` } });
  const inv2 = await db.invoice.create({
    data: {
      branchId, issueId: issue2.id, hospitalId: h2.id, patientId: pat2.id, number: `INV-${year}-00002`, status: "PARTIAL",
      subtotalMinor: 1_300_00, gstMinor: 65_00, totalMinor: 1_365_00, balanceMinor: 365_00, issuedAt: addDays(now, -3),
      lines: { create: [{ description: "PRBC O_POS", qty: 1, unitPriceMinor: 1_300_00, gstRate: 5, amountMinor: 1_300_00 }] },
    },
  });
  await db.payment.create({ data: { invoiceId: inv2.id, method: "CASH", amountMinor: 1_000_00, idempotencyKey: randomUUID(), receivedByUserId: staff["Accountant"] } });
  await db.hospital.update({ where: { id: h2.id }, data: { outstandingMinor: 365_00 } });

  // Approved (awaiting fulfilment): O_NEG PRBC ×1 reserved, no cross-match yet.
  const oneg = pick(r5.components, "PRBC");
  const req3 = await db.bloodRequest.create({ data: { branchId, patientId: pat3.id, hospitalId: h1.id, doctorId: docA.id, channel: "HOSPITAL", priority: "NORMAL", bloodGroup: "O_NEG", componentType: "PRBC", unitsRequested: 1, status: "APPROVED", approvedByUserId: staff["Doctor"], createdAt: addDays(now, -1) } });
  await db.reservation.create({ data: { requestId: req3.id, componentId: oneg.id, status: "HELD", expiresAt: addDays(now, 1) } });

  // Pending: a critical emergency and a routine plasma request.
  await db.bloodRequest.create({ data: { branchId, patientId: pat4.id, hospitalId: h3.id, doctorId: docC.id, channel: "EMERGENCY", priority: "CRITICAL", bloodGroup: "B_POS", componentType: "PRBC", unitsRequested: 2, status: "PENDING", requiredBy: addDays(now, 1), createdAt: addDays(now, -1) } });
  await db.bloodRequest.create({ data: { branchId, patientId: pat5.id, hospitalId: h1.id, channel: "HOSPITAL", priority: "NORMAL", bloodGroup: "O_POS", componentType: "FFP", unitsRequested: 1, status: "PENDING", createdAt: now } });

  void r2; void r4;

  // --- Inventory ledger + cached counters (derived from real component states) ---------
  const allComps = await db.bloodComponent.findMany({ where: { branchId }, select: { id: true, bloodGroup: true, type: true, status: true } });
  for (const c of allComps) {
    await db.inventoryMovement.create({ data: { componentId: c.id, type: "IN", qty: 1, refType: "COMPONENT", byUserId: staff["Lab Technician"] } });
    if (c.status === "RESERVED" || c.status === "ISSUED") await db.inventoryMovement.create({ data: { componentId: c.id, type: "RESERVE", byUserId: staff["Store Manager"] } });
    if (c.status === "ISSUED") await db.inventoryMovement.create({ data: { componentId: c.id, type: "ISSUE", byUserId: staff["Reception"] } });
  }
  const buckets = new Map<string, { available: number; reserved: number; issued: number; expired: number; discarded: number }>();
  for (const c of allComps) {
    const k = `${c.bloodGroup}|${c.type}`;
    const b = buckets.get(k) ?? { available: 0, reserved: 0, issued: 0, expired: 0, discarded: 0 };
    if (c.status === "AVAILABLE") b.available += 1;
    else if (c.status === "RESERVED") b.reserved += 1;
    else if (c.status === "ISSUED") b.issued += 1;
    else if (c.status === "EXPIRED") b.expired += 1;
    else if (c.status === "DISCARDED") b.discarded += 1;
    buckets.set(k, b);
  }
  for (const [k, b] of buckets) {
    const [bloodGroup, componentType] = k.split("|") as [string, string];
    await db.inventoryStock.create({ data: { branchId, bloodGroup: bloodGroup as never, componentType: componentType as never, ...b } });
  }

  // --- Expenses + a couple of in-app notifications for the bell ------------------------
  await db.expense.createMany({
    data: [
      { branchId, head: "Lab reagents", amountMinor: 25_000_00, spentAt: addDays(now, -10), byUserId: staff["Store Manager"] },
      { branchId, head: "Electricity", amountMinor: 18_000_00, spentAt: addDays(now, -7) },
      { branchId, head: "Camp logistics", amountMinor: 5_000_00, spentAt: addDays(now, -15) },
    ],
  });
  await db.notification.createMany({
    data: [
      { branchId, userId: adminId, type: "LOW_STOCK", channel: "INAPP", status: "SENT", sentAt: now, payload: { message: "O_NEG PRBC is running low (1 unit)" } },
      { branchId, userId: adminId, type: "EXPIRY", channel: "INAPP", status: "SENT", sentAt: now, payload: { message: "AB_POS Platelets expiring within 2 days" } },
    ],
  });

  return {
    staff: staffDefs.length,
    donors: donorDefs.length,
    hospitals: 3,
    patients: 5,
    camps: 2,
    components: allComps.length,
    requests: 5,
    issues: 2,
    invoices: 2,
  };
}

async function main() {
  // 1. Permission catalogue
  const permissions: { module: string; action: string }[] = [];
  for (const m of MODULES) for (const a of expandActions(m)) permissions.push({ module: m, action: a });

  await prisma.$transaction(
    permissions.map((p) =>
      prisma.permission.upsert({
        where: { module_action: { module: p.module, action: p.action } },
        update: {},
        create: p,
      }),
    ),
  );
  const allPerms = await prisma.permission.findMany();

  // Resolve a grant pattern (e.g. "lab.*", "*.*", "requests.approve") to permission ids.
  const resolve = (patterns: string[]) => {
    const ids = new Set<string>();
    for (const perm of allPerms) {
      for (const pat of patterns) {
        const [mod, act] = pat.split(".");
        const modOk = mod === "*" || mod === perm.module;
        const actOk = act === "*" || act === perm.action;
        if (modOk && actOk) ids.add(perm.id);
      }
    }
    return [...ids];
  };

  // 2. Roles + role_permission
  for (const [roleName, grants] of Object.entries(ROLE_MATRIX)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, isSystem: true },
    });
    const permIds = resolve(grants);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }

  // 3. Demo organization + branch
  const org = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000001", name: "BloodLine Demo Org" },
  });
  const branch = await prisma.branch.upsert({
    where: { orgId_code: { orgId: org.id, code: "MAIN" } },
    update: {},
    create: { orgId: org.id, name: "Main Branch", code: "MAIN", timezone: "Asia/Kolkata" },
  });

  // 4. Super Admin user with a real bcrypt-hashed password so first login works.
  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { name: "Super Admin" } });
  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: {},
    create: {
      branchId: branch.id,
      roleId: superAdmin.id,
      name: "Super Admin",
      email: SEED_ADMIN_EMAIL,
      passwordHash,
      mfaEnabled: false,
    },
  });

  // 5. A default price list so issue/billing has something to reference.
  const components = ["WHOLE_BLOOD", "PRBC", "PLATELETS", "FFP", "CRYO"] as const;
  const defaultPrices: Record<string, number> = {
    WHOLE_BLOOD: 110000,
    PRBC: 130000,
    PLATELETS: 90000,
    FFP: 60000,
    CRYO: 50000,
  };
  for (const c of components) {
    await prisma.priceListItem.upsert({
      where: {
        branchId_componentType_bloodGroup: {
          branchId: branch.id,
          componentType: c,
          bloodGroup: null as never, // global price (no group-specific override)
        },
      },
      update: { priceMinor: defaultPrices[c], gstRate: 5 },
      create: { branchId: branch.id, componentType: c, priceMinor: defaultPrices[c], gstRate: 5 },
    }).catch(async () => {
      // bloodGroup null is not part of a composite unique in some engines; fall back to create-if-absent.
      const existing = await prisma.priceListItem.findFirst({
        where: { branchId: branch.id, componentType: c, bloodGroup: null },
      });
      if (!existing) {
        await prisma.priceListItem.create({
          data: { id: randomUUID(), branchId: branch.id, componentType: c, priceMinor: defaultPrices[c], gstRate: 5 },
        });
      }
    });
  }

  // 6. Realistic demo data exercising the whole pipeline (donor → collection → lab →
  //    components → inventory → request → reserve → cross-match → issue → invoice →
  //    payment), plus staff, camps and expenses. Skipped with SEED_DEMO=false, and only
  //    created when the branch has no donors yet (idempotent on re-run).
  if (process.env.SEED_DEMO !== "false" && (await prisma.donor.count({ where: { branchId: branch.id } })) === 0) {
    const summary = await seedDemo(prisma, branch.id, admin.id, passwordHash);
    console.log("Demo data seeded:", summary);
  }

  console.log("Seed complete:", {
    permissions: allPerms.length,
    roles: Object.keys(ROLE_MATRIX).length,
    branch: branch.code,
    adminLogin: SEED_ADMIN_EMAIL,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
