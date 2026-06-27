import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

/**
 * Marks blood components whose expiry has passed as EXPIRED, records an EXPIRE
 * inventory movement, and decrements the cached available stock — all atomically
 * per component. Returns the number of components expired.
 *
 * This is the first concrete domain job; request/issue logic builds on the same
 * movement-ledger + cached-counter pattern in later phases.
 */
export async function runExpirySweep(now: Date = new Date()): Promise<number> {
  const due = await prisma.bloodComponent.findMany({
    where: { status: "AVAILABLE", expiresAt: { lt: now } },
    select: { id: true, branchId: true, bloodGroup: true, type: true, version: true },
  });

  let expired = 0;
  for (const c of due) {
    try {
      await prisma.$transaction(async (tx) => {
        // Optimistic concurrency: only expire if still AVAILABLE at this version.
        const updated = await tx.bloodComponent.updateMany({
          where: { id: c.id, status: "AVAILABLE", version: c.version },
          data: { status: "EXPIRED", version: { increment: 1 } },
        });
        if (updated.count === 0) return; // someone else moved it; skip.

        await tx.inventoryMovement.create({
          data: { componentId: c.id, type: "EXPIRE", qty: 1, refType: "JOB", refId: "expiry-sweep" },
        });
        await tx.inventoryStock.updateMany({
          where: { branchId: c.branchId, bloodGroup: c.bloodGroup, componentType: c.type },
          data: { available: { decrement: 1 }, expired: { increment: 1 } },
        });
        expired += 1;
      });
    } catch (err) {
      logger.warn({ err, componentId: c.id }, "expiry sweep: failed to expire component");
    }
  }

  logger.info({ scanned: due.length, expired }, "expiry sweep complete");
  return expired;
}
