import { BLOOD_GROUPS, COMPONENT_TYPES, type Paginated } from "@bloodline/types";
import type { BloodGroup, ComponentType, Prisma } from "@bloodline/db";
import { buildMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import type { MovementsQuery } from "./inventory.dto.js";
import { DEFAULT_THRESHOLDS, stockLevel } from "./stock.js";

export interface MatrixCell {
  bloodGroup: string;
  componentType: string;
  available: number;
  reserved: number;
  issued: number;
  expired: number;
  discarded: number;
  level: "critical" | "low" | "ok";
}

/**
 * Real-time inventory matrix: a full group × component grid (zero-filled) with cached
 * counters and a colour-coded level per cell.
 */
export async function matrix(branchId: string): Promise<{
  groups: readonly string[];
  componentTypes: readonly string[];
  cells: MatrixCell[];
  totalAvailable: number;
}> {
  const rows = await prisma.inventoryStock.findMany({ where: { branchId } });
  const byKey = new Map(rows.map((r) => [`${r.bloodGroup}:${r.componentType}`, r]));

  const cells: MatrixCell[] = [];
  let totalAvailable = 0;
  for (const g of BLOOD_GROUPS) {
    for (const t of COMPONENT_TYPES) {
      const r = byKey.get(`${g}:${t}`);
      const available = r?.available ?? 0;
      totalAvailable += available;
      cells.push({
        bloodGroup: g,
        componentType: t,
        available,
        reserved: r?.reserved ?? 0,
        issued: r?.issued ?? 0,
        expired: r?.expired ?? 0,
        discarded: r?.discarded ?? 0,
        level: stockLevel(available, DEFAULT_THRESHOLDS),
      });
    }
  }
  return { groups: BLOOD_GROUPS, componentTypes: COMPONENT_TYPES, cells, totalAvailable };
}

export async function expiringSoon(branchId: string, days: number) {
  const cutoff = new Date(Date.now() + days * 86_400_000);
  return prisma.bloodComponent.findMany({
    where: { branchId, status: "AVAILABLE", expiresAt: { lte: cutoff } },
    orderBy: { expiresAt: "asc" },
    take: 100,
    include: { unit: { select: { bagNumber: true } } },
  });
}

export async function movements(branchId: string, q: MovementsQuery): Promise<Paginated<unknown>> {
  const where: Prisma.InventoryMovementWhereInput = { component: { branchId } };
  if (q.type) where.type = q.type;
  const { skip, take } = toSkipTake(q.page, q.limit);
  const [rows, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { component: { select: { barcode: true, bloodGroup: true, type: true } } },
    }),
    prisma.inventoryMovement.count({ where }),
  ]);
  return { data: rows, meta: buildMeta(q.page, q.limit, total) };
}

export async function unitsInCell(branchId: string, bloodGroup: BloodGroup, componentType: ComponentType) {
  return prisma.bloodComponent.findMany({
    where: { branchId, bloodGroup, componentType, status: { in: ["AVAILABLE", "RESERVED"] } },
    orderBy: { expiresAt: "asc" },
    include: { unit: { select: { bagNumber: true } } },
  });
}

/**
 * First-Expiry-First-Out selection: the available, non-expired components for a cell,
 * ordered by soonest expiry. Drives wastage-minimising issue suggestions (Phase 6).
 */
export async function fefo(branchId: string, bloodGroup: BloodGroup, componentType: ComponentType, qty: number) {
  return prisma.bloodComponent.findMany({
    where: { branchId, bloodGroup, componentType, status: "AVAILABLE", expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "asc" },
    take: qty,
    include: { unit: { select: { bagNumber: true } } },
  });
}

/** Stock cells at or below the low threshold — feeds low-stock alerts. */
export async function lowStockCells(branchId: string) {
  const rows = await prisma.inventoryStock.findMany({ where: { branchId, available: { lte: DEFAULT_THRESHOLDS.low } } });
  return rows.map((r) => ({ ...r, level: stockLevel(r.available) }));
}
