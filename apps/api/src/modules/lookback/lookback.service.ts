import { writeAudit, type AuditInput } from "../../lib/audit.js";
import { NotFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { adjustStock } from "../inventory/stock.js";

type Ctx = Pick<AuditInput, "ip" | "userAgent"> & { userId: string };

/**
 * Full traceability chain for a donor: every donation → unit → component, and where each
 * component ended up (still in stock, or issued to a patient/hospital). This is the data a
 * recall decision is made on.
 */
export async function traceDonor(branchId: string, donorId: string) {
  const donor = await prisma.donor.findFirst({ where: { id: donorId, branchId }, select: { id: true, donorCode: true, name: true, status: true } });
  if (!donor) throw NotFound("Donor not found");

  const units = await prisma.bloodUnit.findMany({
    where: { branchId, donation: { donorId } },
    include: {
      components: {
        include: {
          issueItem: {
            include: { issue: { select: { id: true, issuedAt: true, patient: { select: { name: true } }, hospital: { select: { id: true, name: true } } } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return { donor, units };
}

/**
 * Executes a recall: quarantines every in-stock (available/reserved) component traced to the
 * donor, blacklists and permanently defers the donor, and notifies the hospitals that
 * received any of the donor's issued components. Returns the impact summary.
 */
export async function recallDonor(branchId: string, ctx: Ctx, donorId: string, reason: string) {
  const donor = await prisma.donor.findFirst({ where: { id: donorId, branchId }, select: { id: true, name: true } });
  if (!donor) throw NotFound("Donor not found");

  const components = await prisma.bloodComponent.findMany({
    where: { branchId, unit: { donation: { donorId } } },
    select: { id: true, status: true, version: true, bloodGroup: true, type: true },
  });
  const componentIds = components.map((c) => c.id);

  // Hospitals that received any of the donor's issued components.
  const issuedItems = componentIds.length
    ? await prisma.issueItem.findMany({ where: { componentId: { in: componentIds } }, include: { issue: { select: { id: true, hospitalId: true } } } })
    : [];
  const affectedHospitalIds = [...new Set(issuedItems.map((i) => i.issue.hospitalId).filter((x): x is string => !!x))];

  const summary = await prisma.$transaction(async (tx) => {
    let quarantined = 0;
    for (const c of components) {
      if (c.status !== "AVAILABLE" && c.status !== "RESERVED") continue;
      const moved = await tx.bloodComponent.updateMany({ where: { id: c.id, status: c.status, version: c.version }, data: { status: "QUARANTINED", version: { increment: 1 } } });
      if (moved.count === 0) continue;
      // Remove from circulating counters (quarantined units are out of availability).
      await adjustStock(tx, branchId, c.bloodGroup, c.type, c.status === "AVAILABLE" ? { available: -1 } : { reserved: -1 });
      quarantined++;
    }

    // Flag the donor permanently.
    await tx.donor.update({ where: { id: donorId }, data: { status: "BLACKLISTED" } });
    await tx.deferral.create({ data: { donorId, type: "PERMANENT", reason: `Recall: ${reason}`, byUserId: ctx.userId } });

    // Notify affected hospitals in a single batched insert.
    if (affectedHospitalIds.length > 0) {
      await tx.notification.createMany({
        data: affectedHospitalIds.map((hospitalId) => ({
          branchId,
          channel: "INAPP" as const,
          type: "recall",
          status: "SENT" as const,
          sentAt: new Date(),
          payload: { title: "Blood recall notice", message: `Units from a recalled donor were issued to your hospital. Reason: ${reason}`, donorId, hospitalId },
        })),
      });
    }

    await writeAudit({ branchId, userId: ctx.userId, entity: "lookback", entityId: donorId, action: "RECALL", after: { reason, quarantined, affectedIssues: issuedItems.length, notifiedHospitals: affectedHospitalIds.length } }, tx);
    return { quarantined, affectedIssues: issuedItems.length, notifiedHospitals: affectedHospitalIds.length };
  });

  return summary;
}
