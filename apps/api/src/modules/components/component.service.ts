import type { BloodComponent, ComponentType } from "@bloodline/db";
import { writeAudit, type AuditInput } from "../../lib/audit.js";
import { Conflict, DomainError, NotFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { adjustStock, recordMovement } from "../inventory/stock.js";
import type { SeparateInput } from "./component.dto.js";
import { computeComponentExpiry, generateBarcode, STORAGE_TEMP } from "./component.util.js";

type Ctx = Pick<AuditInput, "ip" | "userAgent"> & { userId: string };

/**
 * Separates an APPROVED unit into the requested components. In one transaction it creates
 * each component (barcode, type-based expiry, storage), records an IN movement, increments
 * the cached stock counters, and marks the parent unit SEPARATED — preserving full
 * parent→component traceability. Uses optimistic concurrency on the unit version.
 */
export async function separate(branchId: string, ctx: Ctx, unitId: string, input: SeparateInput) {
  const unit = await prisma.bloodUnit.findFirst({ where: { id: unitId, branchId } });
  if (!unit) throw NotFound("Unit not found");
  if (unit.status !== "APPROVED") {
    throw DomainError("Only an approved (lab-cleared) unit can be separated into components");
  }

  const preparedAt = new Date();
  const created = await prisma.$transaction(async (tx) => {
    // Optimistic lock: only proceed if the unit is still APPROVED at this version.
    const locked = await tx.bloodUnit.updateMany({
      where: { id: unitId, status: "APPROVED", version: unit.version },
      data: { status: "SEPARATED", version: { increment: 1 } },
    });
    if (locked.count === 0) throw Conflict("Unit was modified concurrently; please retry");

    const components: BloodComponent[] = [];
    for (const type of input.types as ComponentType[]) {
      const component = await tx.bloodComponent.create({
        data: {
          branchId,
          unitId,
          type,
          bloodGroup: unit.bloodGroup,
          barcode: generateBarcode(),
          volumeMl: input.volumeMl ?? unit.volumeMl,
          storageTemp: STORAGE_TEMP[type],
          storageLocation: input.storageLocation ?? null,
          preparedAt,
          expiresAt: computeComponentExpiry(type, preparedAt),
          status: "AVAILABLE",
        },
      });
      await recordMovement(tx, component.id, "IN", { refType: "SEPARATION", refId: unitId, byUserId: ctx.userId });
      await adjustStock(tx, branchId, unit.bloodGroup, type, { available: 1 });
      components.push(component);
    }

    await writeAudit(
      { branchId, userId: ctx.userId, entity: "unit", entityId: unitId, action: "SEPARATE", after: { types: input.types, components: components.map((c) => c.barcode) } },
      tx,
    );
    return components;
  });

  return created;
}

export async function getComponent(branchId: string, id: string) {
  const component = await prisma.bloodComponent.findFirst({
    where: { id, branchId },
    include: {
      unit: { select: { bagNumber: true, donation: { select: { donor: { select: { donorCode: true, name: true } } } } } },
      movements: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!component) throw NotFound("Component not found");
  return component;
}

export async function getByBarcode(branchId: string, barcode: string) {
  const component = await prisma.bloodComponent.findFirst({ where: { barcode, branchId } });
  if (!component) throw NotFound("No component with that barcode");
  return component;
}

/** Discards an available/quarantined component, updating the ledger and counters. */
export async function discard(branchId: string, ctx: Ctx, id: string, reason: string) {
  const component = await prisma.bloodComponent.findFirst({ where: { id, branchId } });
  if (!component) throw NotFound("Component not found");
  if (component.status === "ISSUED" || component.status === "DISCARDED" || component.status === "EXPIRED") {
    throw DomainError(`Cannot discard a component that is ${component.status}`);
  }

  await prisma.$transaction(async (tx) => {
    const locked = await tx.bloodComponent.updateMany({
      where: { id, status: component.status, version: component.version },
      data: { status: "DISCARDED", version: { increment: 1 } },
    });
    if (locked.count === 0) throw Conflict("Component was modified concurrently; please retry");

    await recordMovement(tx, id, "DISCARD", { refType: "MANUAL", refId: reason, byUserId: ctx.userId });
    // Only release from "available" if it was counted there.
    const delta = component.status === "AVAILABLE" ? { available: -1, discarded: 1 } : { discarded: 1 };
    await adjustStock(tx, branchId, component.bloodGroup, component.type, delta);
    await writeAudit({ branchId, userId: ctx.userId, entity: "component", entityId: id, action: "DISCARD", before: component, after: { reason } }, tx);
  });
}
