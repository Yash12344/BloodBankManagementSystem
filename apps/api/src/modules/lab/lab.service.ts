import type { Paginated } from "@bloodline/types";
import type { LabTest, Prisma } from "@bloodline/db";
import { writeAudit, type AuditInput } from "../../lib/audit.js";
import { Conflict, DomainError, NotFound } from "../../lib/errors.js";
import { buildMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import type { LabTestsInput, LabWorklistQuery } from "./lab.dto.js";
import { summarizeTti, type MarkerValue } from "./lab.util.js";

type Ctx = Pick<AuditInput, "ip" | "userAgent"> & { userId: string };

function ttiOf(lab: Pick<LabTest, "hiv" | "hbsag" | "hcv" | "malaria" | "syphilis">) {
  return summarizeTti({
    hiv: lab.hiv as MarkerValue,
    hbsag: lab.hbsag as MarkerValue,
    hcv: lab.hcv as MarkerValue,
    malaria: lab.malaria as MarkerValue,
    syphilis: lab.syphilis as MarkerValue,
  });
}

export async function worklist(branchId: string, q: LabWorklistQuery): Promise<Paginated<unknown>> {
  const where: Prisma.LabTestWhereInput = {
    unit: { branchId },
    result: q.result ?? "PENDING",
  };
  const { skip, take } = toSkipTake(q.page, q.limit);
  const [rows, total] = await Promise.all([
    prisma.labTest.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "asc" },
      include: {
        unit: {
          select: {
            id: true,
            bagNumber: true,
            bloodGroup: true,
            status: true,
            donation: { select: { donor: { select: { donorCode: true, name: true } } } },
          },
        },
      },
    }),
    prisma.labTest.count({ where }),
  ]);
  return { data: rows, meta: buildMeta(q.page, q.limit, total) };
}

async function loadUnitLab(branchId: string, unitId: string) {
  const unit = await prisma.bloodUnit.findFirst({ where: { id: unitId, branchId }, include: { labTest: true } });
  if (!unit || !unit.labTest) throw NotFound("Unit or lab record not found");
  return unit;
}

export async function getLab(branchId: string, unitId: string) {
  return loadUnitLab(branchId, unitId);
}

/** Records/updates test values. Reactive markers quarantine the unit immediately. */
export async function recordTests(branchId: string, ctx: Ctx, unitId: string, input: LabTestsInput) {
  const unit = await loadUnitLab(branchId, unitId);
  if (unit.labTest!.result === "APPROVED") throw DomainError("Approved lab records are immutable");

  const updatedLab = await prisma.labTest.update({
    where: { unitId },
    data: { ...input, testedByUserId: ctx.userId },
  });

  const tti = ttiOf(updatedLab);
  const nextUnitStatus = tti.anyReactive ? "QUARANTINED" : unit.status === "COLLECTED" ? "PROCESSING" : unit.status;
  if (nextUnitStatus !== unit.status) {
    await prisma.bloodUnit.update({ where: { id: unitId }, data: { status: nextUnitStatus } });
  }

  await writeAudit({ branchId, userId: ctx.userId, entity: "lab", entityId: unitId, action: "RECORD_TESTS", after: { tests: input, reactive: tti.anyReactive } });
  return { ...updatedLab, tti };
}

/** Approves a unit for inventory. Blocked unless every TTI marker is non-reactive. */
export async function approve(branchId: string, ctx: Ctx, unitId: string) {
  const unit = await loadUnitLab(branchId, unitId);
  const lab = unit.labTest!;
  if (lab.result !== "PENDING") throw DomainError(`Lab already ${lab.result.toLowerCase()}`);

  const tti = ttiOf(lab);
  if (tti.anyPending) throw DomainError("All TTI markers must be tested before approval");
  if (tti.anyReactive) throw DomainError("Cannot approve a unit with a reactive TTI result");

  const result = await prisma.$transaction(async (tx) => {
    // Re-validate atomically: only release if the record is STILL pending and every TTI
    // marker is STILL non-reactive. Closes the TOCTOU where a concurrent recordTests marks
    // a marker reactive (quarantining the unit) between our check above and this write —
    // without this guard, approval would silently overwrite that quarantine.
    const approved = await tx.labTest.updateMany({
      where: {
        unitId,
        result: "PENDING",
        hiv: "NON_REACTIVE",
        hbsag: "NON_REACTIVE",
        hcv: "NON_REACTIVE",
        malaria: "NON_REACTIVE",
        syphilis: "NON_REACTIVE",
      },
      data: { result: "APPROVED", verifiedByUserId: ctx.userId, approvedAt: new Date() },
    });
    if (approved.count === 0) {
      throw Conflict("Lab results changed during approval; re-check the screening panel before releasing");
    }
    await tx.bloodUnit.update({ where: { id: unitId }, data: { status: "APPROVED" } });
    const approvedLab = await tx.labTest.findUniqueOrThrow({ where: { unitId } });
    await writeAudit({ branchId, userId: ctx.userId, entity: "lab", entityId: unitId, action: "APPROVE", after: approvedLab }, tx);
    return approvedLab;
  });
  return result;
}

/**
 * Rejects a unit. The unit is discarded; if any TTI was reactive the donor is permanently
 * deferred (a minimal look-back safeguard).
 */
export async function reject(branchId: string, ctx: Ctx, unitId: string, reason: string) {
  const unit = await loadUnitLab(branchId, unitId);
  const lab = unit.labTest!;
  if (lab.result === "APPROVED") throw DomainError("Cannot reject an already-approved unit");
  const tti = ttiOf(lab);

  await prisma.$transaction(async (tx) => {
    await tx.labTest.update({ where: { unitId }, data: { result: "REJECTED", comments: reason } });
    await tx.bloodUnit.update({ where: { id: unitId }, data: { status: "DISCARDED" } });

    if (tti.anyReactive) {
      const donation = await tx.donation.findUnique({ where: { id: unit.donationId }, select: { donorId: true } });
      if (donation) {
        await tx.deferral.create({
          data: { donorId: donation.donorId, type: "PERMANENT", reason: "Reactive TTI screening result", byUserId: ctx.userId },
        });
        await tx.donor.update({ where: { id: donation.donorId }, data: { status: "BLACKLISTED" } });
      }
    }

    await writeAudit({ branchId, userId: ctx.userId, entity: "lab", entityId: unitId, action: "REJECT", after: { reason, reactive: tti.anyReactive } }, tx);
  });
}
