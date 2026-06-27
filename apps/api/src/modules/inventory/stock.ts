import type { BloodGroup, ComponentType, MovementType, Prisma } from "@bloodline/db";

export type StockField = "available" | "reserved" | "issued" | "expired" | "discarded";

/**
 * Atomically upserts the cached inventory counters for a branch × group × component cell.
 * The InventoryMovement ledger is the source of truth; these counters are a denormalized
 * cache maintained transactionally on every movement (see docs/DATABASE.md §7).
 *
 * Must be called inside a transaction together with the movement it reflects.
 */
export async function adjustStock(
  tx: Prisma.TransactionClient,
  branchId: string,
  bloodGroup: BloodGroup,
  componentType: ComponentType,
  deltas: Partial<Record<StockField, number>>,
): Promise<void> {
  const inc = (f: StockField) => deltas[f] ?? 0;
  await tx.inventoryStock.upsert({
    where: { branchId_bloodGroup_componentType: { branchId, bloodGroup, componentType } },
    create: {
      branchId,
      bloodGroup,
      componentType,
      available: Math.max(0, inc("available")),
      reserved: Math.max(0, inc("reserved")),
      issued: Math.max(0, inc("issued")),
      expired: Math.max(0, inc("expired")),
      discarded: Math.max(0, inc("discarded")),
    },
    update: {
      available: { increment: inc("available") },
      reserved: { increment: inc("reserved") },
      issued: { increment: inc("issued") },
      expired: { increment: inc("expired") },
      discarded: { increment: inc("discarded") },
      version: { increment: 1 },
    },
  });
}

/** Appends an entry to the immutable inventory movement ledger. */
export async function recordMovement(
  tx: Prisma.TransactionClient,
  componentId: string,
  type: MovementType,
  opts: { qty?: number; refType?: string; refId?: string; byUserId?: string | null } = {},
): Promise<void> {
  await tx.inventoryMovement.create({
    data: {
      componentId,
      type,
      qty: opts.qty ?? 1,
      refType: opts.refType ?? null,
      refId: opts.refId ?? null,
      byUserId: opts.byUserId ?? null,
    },
  });
}

export type StockLevel = "critical" | "low" | "ok";

export interface StockThresholds {
  critical: number;
  low: number;
}

export const DEFAULT_THRESHOLDS: StockThresholds = { critical: 2, low: 5 };

/** Classifies an available count into a colour-coded level for the inventory grid. */
export function stockLevel(available: number, t: StockThresholds = DEFAULT_THRESHOLDS): StockLevel {
  if (available <= t.critical) return "critical";
  if (available <= t.low) return "low";
  return "ok";
}
