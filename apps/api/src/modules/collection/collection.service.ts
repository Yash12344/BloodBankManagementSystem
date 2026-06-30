import type { Paginated } from "@bloodline/types";
import { Prisma } from "@bloodline/db";
import { randomBytes } from "node:crypto";
import { writeAudit, type AuditInput } from "../../lib/audit.js";
import { DomainError, NotFound } from "../../lib/errors.js";
import { buildMeta, parseSort, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import { computeNextEligible, evaluateEligibility } from "../donors/eligibility.js";
import type { CollectionCreateInput, CollectionListQuery } from "./collection.dto.js";

type Ctx = Pick<AuditInput, "ip" | "userAgent"> & { userId: string };

const SORTABLE = ["collectedAt", "createdAt", "status"] as const;

function generateBagNumber(): string {
  return `BG-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

/**
 * Records a donation. In a single transaction it creates the donation, the blood unit,
 * a PENDING lab record (so the unit can never reach inventory unscreened), and updates the
 * donor's donation counters and next-eligible date. Blocks ineligible donors unless an
 * explicit, reasoned override is supplied.
 */
export async function createCollection(branchId: string, ctx: Ctx, input: CollectionCreateInput) {
  const donor = await prisma.donor.findFirst({ where: { id: input.donorId, branchId, deletedAt: null } });
  if (!donor) throw NotFound("Donor not found");

  // Absolute contraindication: a blacklisted donor (e.g. permanently deferred after a
  // reactive TTI screen) can NEVER be bled — not even with an eligibility override.
  if (donor.status === "BLACKLISTED") {
    throw DomainError("Donor is permanently deferred (blacklisted) and cannot be bled. Override is not permitted.");
  }

  const now = new Date();
  const collectedAt = input.collectedAt ?? now;
  // Collections cannot be future-dated — it would corrupt eligibility/next-eligible math
  // and the audit timeline. A small clock-skew margin is allowed.
  if (collectedAt.getTime() > now.getTime() + 5 * 60_000) {
    throw DomainError("Collection time cannot be in the future");
  }

  const eligibility = evaluateEligibility({
    dob: donor.dob,
    gender: donor.gender,
    weightKg: donor.weightKg,
    status: donor.status,
    lastDonationAt: donor.lastDonationAt,
    now: collectedAt,
  });
  if (!eligibility.eligible && !input.override) {
    throw DomainError("Donor is not eligible to donate", { reasons: eligibility.reasons });
  }

  // Donor-safety cap: collected volume must not exceed ~10.5 ml per kg of body weight
  // (regulatory limit, samples included). This is a hard limit — not overridable.
  const maxVolumeMl = Math.floor(donor.weightKg * 10.5);
  if (input.volumeMl > maxVolumeMl) {
    throw DomainError(
      `Volume ${input.volumeMl} ml exceeds the safe limit of ${maxVolumeMl} ml for a ${donor.weightKg} kg donor (10.5 ml/kg)`,
    );
  }

  if (input.campId) {
    const camp = await prisma.camp.findFirst({ where: { id: input.campId, branchId } });
    if (!camp) throw NotFound("Camp not found");
  }

  // Retry once on the (improbable) bag-number collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const donation = await tx.donation.create({
          data: {
            branchId,
            donorId: donor.id,
            campId: input.campId ?? null,
            collectedByUserId: ctx.userId,
            donationType: input.donationType,
            source: input.source,
            collectedAt,
            volumeMl: input.volumeMl,
            status: "COLLECTED",
          },
        });

        const unit = await tx.bloodUnit.create({
          data: {
            branchId,
            donationId: donation.id,
            bagNumber: generateBagNumber(),
            bloodGroup: donor.bloodGroup,
            volumeMl: input.volumeMl,
            status: "COLLECTED",
          },
        });

        // Open the mandatory screening record up front.
        await tx.labTest.create({ data: { unitId: unit.id, result: "PENDING" } });

        await tx.donor.update({
          where: { id: donor.id },
          data: {
            donationCount: { increment: 1 },
            lastDonationAt: collectedAt,
            nextEligibleAt: computeNextEligible(collectedAt, donor.gender),
          },
        });

        await writeAudit(
          {
            branchId,
            userId: ctx.userId,
            entity: "collection",
            entityId: donation.id,
            action: input.override ? "COLLECT_OVERRIDE" : "COLLECT",
            after: { donation, unit, override: input.override, overrideReason: input.overrideReason },
            ip: ctx.ip,
            userAgent: ctx.userAgent,
          },
          tx,
        );

        return { donation, unit };
      });

      return result;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 2) {
        continue; // bag number collision; regenerate and retry
      }
      throw err;
    }
  }
  throw DomainError("Could not allocate a unique bag number, please retry");
}

export async function listCollections(branchId: string, q: CollectionListQuery): Promise<Paginated<unknown>> {
  const where: Prisma.DonationWhereInput = { branchId };
  if (q.status) where.status = q.status;
  if (q.donorId) where.donorId = q.donorId;
  if (q.campId) where.campId = q.campId;
  if (q.dateFrom || q.dateTo) {
    const range: Prisma.DateTimeFilter = {};
    if (q.dateFrom) range.gte = q.dateFrom;
    if (q.dateTo) range.lte = q.dateTo;
    where.collectedAt = range;
  }

  const { skip, take } = toSkipTake(q.page, q.limit);
  const [rows, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      skip,
      take,
      orderBy: parseSort(q.sort, SORTABLE, { collectedAt: "desc" }) as Prisma.DonationOrderByWithRelationInput,
      include: {
        donor: { select: { donorCode: true, name: true, bloodGroup: true } },
        unit: { select: { bagNumber: true, status: true } },
      },
    }),
    prisma.donation.count({ where }),
  ]);

  return { data: rows, meta: buildMeta(q.page, q.limit, total) };
}

export async function getCollection(branchId: string, id: string) {
  const donation = await prisma.donation.findFirst({
    where: { id, branchId },
    include: {
      donor: { select: { id: true, donorCode: true, name: true, bloodGroup: true, mobile: true } },
      camp: { select: { id: true, name: true } },
      unit: { include: { labTest: true } },
    },
  });
  if (!donation) throw NotFound("Collection not found");
  return donation;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  COLLECTED: ["PROCESSING", "REJECTED"],
  PROCESSING: ["COMPLETED", "REJECTED"],
  COMPLETED: [],
  REJECTED: [],
};

export async function updateStatus(branchId: string, ctx: Ctx, id: string, status: string) {
  const donation = await prisma.donation.findFirst({ where: { id, branchId } });
  if (!donation) throw NotFound("Collection not found");

  const allowed = ALLOWED_TRANSITIONS[donation.status] ?? [];
  if (!allowed.includes(status)) {
    throw DomainError(`Cannot move collection from ${donation.status} to ${status}`);
  }

  const updated = await prisma.donation.update({
    where: { id },
    data: { status: status as Prisma.DonationUpdateInput["status"] },
  });
  await writeAudit({ branchId, userId: ctx.userId, entity: "collection", entityId: id, action: "STATUS", before: donation, after: updated, ip: ctx.ip, userAgent: ctx.userAgent });
  return updated;
}
