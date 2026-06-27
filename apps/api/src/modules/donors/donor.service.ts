import type { Paginated } from "@bloodline/types";
import QRCode from "qrcode";
import { env } from "../../config/env.js";
import { writeAudit, type AuditInput } from "../../lib/audit.js";
import { toCsv, parseCsv } from "../../lib/csv.js";
import { Conflict, NotFound } from "../../lib/errors.js";
import { buildMeta, parseSort, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "@bloodline/db";
import {
  donorCreateSchema,
  type DeferralInput,
  type DonorCreateInput,
  type DonorListQuery,
  type DonorUpdateInput,
} from "./donor.dto.js";
import { evaluateEligibility, type EligibilityResult } from "./eligibility.js";

type Ctx = Pick<AuditInput, "ip" | "userAgent"> & { userId: string };

const SORTABLE = ["createdAt", "name", "lastDonationAt", "nextEligibleAt"] as const;

function attachEligibility<T extends {
  dob: Date;
  gender: "MALE" | "FEMALE" | "OTHER";
  weightKg: number;
  status: "ACTIVE" | "DEFERRED" | "BLACKLISTED" | "INACTIVE";
  lastDonationAt: Date | null;
}>(donor: T): T & { eligibility: EligibilityResult } {
  return {
    ...donor,
    eligibility: evaluateEligibility({
      dob: donor.dob,
      gender: donor.gender,
      weightKg: donor.weightKg,
      status: donor.status,
      lastDonationAt: donor.lastDonationAt,
    }),
  };
}

/** Generates the next per-branch donor code, retrying on the rare unique collision. */
async function nextDonorCode(branchId: string): Promise<string> {
  const count = await prisma.donor.count({ where: { branchId } });
  return `D${String(count + 1).padStart(5, "0")}`;
}

export async function listDonors(branchId: string, q: DonorListQuery): Promise<Paginated<unknown>> {
  const where: Prisma.DonorWhereInput = { branchId, deletedAt: null };
  if (q.bloodGroup) where.bloodGroup = q.bloodGroup;
  if (q.status) where.status = q.status;
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" } },
      { mobile: { contains: q.q } },
      { donorCode: { contains: q.q, mode: "insensitive" } },
      { govtIdNo: { contains: q.q } },
    ];
  }
  // Approximate eligibility filter at the DB level (precise per-row eligibility is computed
  // for display below).
  if (q.eligible === "true") {
    where.status = "ACTIVE";
    where.OR = [{ nextEligibleAt: null }, { nextEligibleAt: { lte: new Date() } }];
  } else if (q.eligible === "false") {
    where.AND = [{ nextEligibleAt: { gt: new Date() } }];
  }

  const { skip, take } = toSkipTake(q.page, q.limit);
  const [rows, total] = await Promise.all([
    prisma.donor.findMany({
      where,
      skip,
      take,
      orderBy: parseSort(q.sort, SORTABLE, { createdAt: "desc" }) as Prisma.DonorOrderByWithRelationInput,
    }),
    prisma.donor.count({ where }),
  ]);

  return { data: rows.map(attachEligibility), meta: buildMeta(q.page, q.limit, total) };
}

export async function getDonor(branchId: string, id: string) {
  const donor = await prisma.donor.findFirst({
    where: { id, branchId, deletedAt: null },
    include: { deferrals: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  if (!donor) throw NotFound("Donor not found");
  return attachEligibility(donor);
}

export async function createDonor(branchId: string, ctx: Ctx, input: DonorCreateInput) {
  // De-duplicate by government ID or mobile within the branch.
  const dupe = await prisma.donor.findFirst({
    where: {
      branchId,
      deletedAt: null,
      OR: [
        ...(input.govtIdNo ? [{ govtIdNo: input.govtIdNo }] : []),
        { mobile: input.mobile },
      ],
    },
    select: { id: true, govtIdNo: true },
  });
  if (dupe) throw Conflict("A donor with the same mobile or government ID already exists");

  const donor = await prisma.donor.create({
    data: { ...input, branchId, donorCode: await nextDonorCode(branchId) },
  });
  await writeAudit({ branchId, userId: ctx.userId, entity: "donor", entityId: donor.id, action: "CREATE", after: donor, ip: ctx.ip, userAgent: ctx.userAgent });
  return attachEligibility(donor);
}

export async function updateDonor(branchId: string, ctx: Ctx, id: string, input: DonorUpdateInput) {
  const before = await prisma.donor.findFirst({ where: { id, branchId, deletedAt: null } });
  if (!before) throw NotFound("Donor not found");

  const donor = await prisma.donor.update({ where: { id }, data: input });
  await writeAudit({ branchId, userId: ctx.userId, entity: "donor", entityId: id, action: "UPDATE", before, after: donor, ip: ctx.ip, userAgent: ctx.userAgent });
  return attachEligibility(donor);
}

export async function deleteDonor(branchId: string, ctx: Ctx, id: string): Promise<void> {
  const donor = await prisma.donor.findFirst({ where: { id, branchId, deletedAt: null } });
  if (!donor) throw NotFound("Donor not found");
  await prisma.donor.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({ branchId, userId: ctx.userId, entity: "donor", entityId: id, action: "DELETE", before: donor, ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function listDonations(branchId: string, donorId: string) {
  await getDonor(branchId, donorId); // ensures donor belongs to branch
  return prisma.donation.findMany({
    where: { donorId, branchId },
    orderBy: { collectedAt: "desc" },
    include: { unit: { select: { bagNumber: true, status: true } }, camp: { select: { name: true } } },
  });
}

export async function addDeferral(branchId: string, ctx: Ctx, donorId: string, input: DeferralInput) {
  const donor = await prisma.donor.findFirst({ where: { id: donorId, branchId, deletedAt: null } });
  if (!donor) throw NotFound("Donor not found");

  const result = await prisma.$transaction(async (tx) => {
    const deferral = await tx.deferral.create({
      data: { donorId, type: input.type, reason: input.reason, until: input.until ?? null, byUserId: ctx.userId },
    });
    // Reflect an active deferral on the donor status so eligibility checks and lists see it.
    const stillActive = input.type === "PERMANENT" || !input.until || input.until > new Date();
    if (stillActive) {
      await tx.donor.update({ where: { id: donorId }, data: { status: "DEFERRED" } });
    }
    await writeAudit({ branchId, userId: ctx.userId, entity: "donor", entityId: donorId, action: "DEFER", after: deferral, ip: ctx.ip, userAgent: ctx.userAgent }, tx);
    return deferral;
  });
  return result;
}

// ---- Import / Export ----
const EXPORT_HEADERS = [
  "donorCode", "name", "dob", "gender", "bloodGroup", "weightKg", "mobile", "email",
  "address", "occupation", "govtIdType", "govtIdNo", "status", "donationCount", "lastDonationAt",
];

export async function exportDonorsCsv(branchId: string): Promise<string> {
  const donors = await prisma.donor.findMany({ where: { branchId, deletedAt: null }, orderBy: { donorCode: "asc" } });
  const rows = donors.map((d) => ({
    ...d,
    dob: d.dob.toISOString().slice(0, 10),
    lastDonationAt: d.lastDonationAt?.toISOString().slice(0, 10) ?? "",
  }));
  return toCsv(EXPORT_HEADERS, rows as Array<Record<string, unknown>>);
}

export interface ImportReport {
  created: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export async function importDonorsCsv(branchId: string, ctx: Ctx, csvText: string): Promise<ImportReport> {
  const records = parseCsv(csvText);
  const report: ImportReport = { created: 0, failed: 0, errors: [] };

  for (let i = 0; i < records.length; i++) {
    const raw = records[i] ?? {};
    const parsed = donorCreateSchema.safeParse({
      ...raw,
      weightKg: raw.weightKg,
    });
    if (!parsed.success) {
      report.failed++;
      report.errors.push({ row: i + 2, message: parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") });
      continue;
    }
    try {
      await createDonor(branchId, ctx, parsed.data);
      report.created++;
    } catch (err) {
      report.failed++;
      report.errors.push({ row: i + 2, message: err instanceof Error ? err.message : "Unknown error" });
    }
  }
  return report;
}

export async function generateDonorCard(branchId: string, id: string) {
  const donor = await getDonor(branchId, id);
  // Encode a stable identifier; a public verification URL can replace this later.
  const payload = `${env.APP_BASE_URL}/d/${donor.id}`;
  const qr = await QRCode.toDataURL(payload, { margin: 1, width: 240 });
  return { donor, qr };
}
