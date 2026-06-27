import { BLOOD_GROUP_LABEL } from "@bloodline/types";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { DEFAULT_THRESHOLDS } from "../modules/inventory/stock.js";

/**
 * Scans cached stock across all branches for cells at/below the low threshold and raises an
 * in-app notification per affected cell (de-duplicated per day). Email/SMS fan-out is added
 * in the notifications phase; the trigger and record live here.
 */
export async function runLowStockCheck(now: Date = new Date()): Promise<number> {
  const low = await prisma.inventoryStock.findMany({
    where: { available: { lte: DEFAULT_THRESHOLDS.low } },
  });

  const day = now.toISOString().slice(0, 10);
  let raised = 0;
  for (const cell of low) {
    const type = `low_stock:${cell.bloodGroup}:${cell.componentType}:${day}`;
    const exists = await prisma.notification.findFirst({
      where: { branchId: cell.branchId, type, createdAt: { gte: new Date(`${day}T00:00:00Z`) } },
      select: { id: true },
    });
    if (exists) continue;

    const label = BLOOD_GROUP_LABEL[cell.bloodGroup];
    await prisma.notification.create({
      data: {
        branchId: cell.branchId,
        channel: "INAPP",
        type,
        status: "SENT",
        sentAt: now,
        payload: {
          title: "Low stock alert",
          message: `${label} ${cell.componentType} is low (${cell.available} available)`,
          bloodGroup: cell.bloodGroup,
          componentType: cell.componentType,
          available: cell.available,
        },
      },
    });
    raised++;
  }

  logger.info({ scanned: low.length, raised }, "low-stock check complete");
  return raised;
}
