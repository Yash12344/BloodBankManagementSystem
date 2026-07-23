import type { Paginated } from "@bloodline/types";
import type { Prisma } from "@bloodline/db";
import { writeAudit, type AuditInput } from "../../lib/audit.js";
import { evaluateCompatibility } from "../../lib/bloodCompatibility.js";
import { DomainError, NotFound } from "../../lib/errors.js";
import { buildMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import { adjustStock, recordMovement } from "../inventory/stock.js";
import type { RequestCreateInput, RequestListQuery } from "./request.dto.js";

type Ctx = Pick<AuditInput, "ip" | "userAgent"> & { userId: string };

export async function createRequest(branchId: string, ctx: Ctx, input: RequestCreateInput) {
  // Validate referenced entities belong to the branch.
  let patientGroup: string | null = null;
  if (input.patientId) {
    const p = await prisma.patient.findFirst({ where: { id: input.patientId, branchId, deletedAt: null }, select: { id: true, bloodGroup: true } });
    if (!p) throw NotFound("Patient not found");
    patientGroup = p.bloodGroup;
  }
  if (input.hospitalId) {
    const h = await prisma.hospital.findFirst({ where: { id: input.hospitalId, branchId, deletedAt: null }, select: { id: true } });
    if (!h) throw NotFound("Hospital not found");
  }

  // If the patient's group is known, the ordered group must be transfusion-compatible —
  // catches a wrong-group order before any unit is reserved against it.
  if (patientGroup) {
    const compat = evaluateCompatibility(input.bloodGroup, patientGroup, input.componentType);
    if (!compat.compatible) {
      throw DomainError(
        `Requested ${input.bloodGroup} ${input.componentType} is not compatible with patient group ${patientGroup}: ${compat.reason}`,
        { requestedGroup: input.bloodGroup, patientGroup },
      );
    }
  }

  const request = await prisma.bloodRequest.create({ data: { ...input, branchId, status: "PENDING" } });

  // Surface emergencies as an in-app notification immediately.
  if (request.priority === "CRITICAL") {
    await prisma.notification.create({
      data: {
        branchId,
        channel: "INAPP",
        type: "emergency_request",
        status: "SENT",
        sentAt: new Date(),
        payload: {
          title: "Emergency blood request",
          message: `${request.unitsRequested}× ${request.bloodGroup} ${request.componentType} required`,
          requestId: request.id,
        },
      },
    });
  }

  await writeAudit({ branchId, userId: ctx.userId, entity: "request", entityId: request.id, action: "CREATE", after: request });
  return request;
}

export async function listRequests(branchId: string, q: RequestListQuery): Promise<Paginated<unknown>> {
  const where: Prisma.BloodRequestWhereInput = { branchId };
  if (q.status) where.status = q.status;
  if (q.priority) where.priority = q.priority;
  if (q.hospitalId) where.hospitalId = q.hospitalId;

  const { skip, take } = toSkipTake(q.page, q.limit);
  const [data, total] = await Promise.all([
    prisma.bloodRequest.findMany({
      where,
      skip,
      take,
      // Critical first, then oldest required-by.
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      include: {
        patient: { select: { name: true } },
        hospital: { select: { name: true } },
        _count: { select: { reservations: true } },
      },
    }),
    prisma.bloodRequest.count({ where }),
  ]);
  return { data, meta: buildMeta(q.page, q.limit, total) };
}

export async function getRequest(branchId: string, id: string) {
  const request = await prisma.bloodRequest.findFirst({
    where: { id, branchId },
    include: {
      patient: { select: { id: true, name: true, bloodGroup: true } },
      hospital: { select: { id: true, name: true } },
      reservations: {
        where: { status: "HELD" },
        include: { component: { select: { id: true, barcode: true, expiresAt: true, status: true } } },
      },
      crossMatches: true,
    },
  });
  if (!request) throw NotFound("Request not found");
  return request;
}

/**
 * Approves a request and reserves matching components using FEFO. Reservation is
 * concurrency-safe: each component is moved AVAILABLE→RESERVED with an optimistic version
 * guard, so two simultaneous approvals can never reserve the same unit. Reserves up to the
 * requested quantity; fewer when stock is short (partial), and reports the shortfall.
 */
export async function approveRequest(branchId: string, ctx: Ctx, id: string) {
  const request = await prisma.bloodRequest.findFirst({ where: { id, branchId } });
  if (!request) throw NotFound("Request not found");
  if (request.status !== "PENDING") throw DomainError(`Request is already ${request.status.toLowerCase()}`);

  const reservedCount = await prisma.$transaction(async (tx) => {
    // FEFO candidates: oldest-expiring available units of the right group/component.
    const candidates = await tx.bloodComponent.findMany({
      where: {
        branchId,
        bloodGroup: request.bloodGroup,
        type: request.componentType,
        status: "AVAILABLE",
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: "asc" },
      take: request.unitsRequested * 2, // over-fetch to absorb concurrent contention
      select: { id: true, version: true, bloodGroup: true, type: true },
    });

    let reserved = 0;
    for (const comp of candidates) {
      if (reserved >= request.unitsRequested) break;
      const locked = await tx.bloodComponent.updateMany({
        where: { id: comp.id, status: "AVAILABLE", version: comp.version },
        data: { status: "RESERVED", version: { increment: 1 } },
      });
      if (locked.count === 0) continue; // taken concurrently; skip
      await tx.reservation.create({ data: { requestId: id, componentId: comp.id, status: "HELD" } });
      await recordMovement(tx, comp.id, "RESERVE", { refType: "REQUEST", refId: id, byUserId: ctx.userId });
      await adjustStock(tx, branchId, comp.bloodGroup, comp.type, { available: -1, reserved: 1 });
      reserved++;
    }

    await tx.bloodRequest.update({ where: { id }, data: { status: "APPROVED", approvedByUserId: ctx.userId } });
    await writeAudit({ branchId, userId: ctx.userId, entity: "request", entityId: id, action: "APPROVE", after: { reserved, requested: request.unitsRequested } }, tx);
    return reserved;
  });

  return { reserved: reservedCount, requested: request.unitsRequested, shortfall: Math.max(0, request.unitsRequested - reservedCount) };
}

export async function rejectRequest(branchId: string, ctx: Ctx, id: string, reason: string) {
  const request = await prisma.bloodRequest.findFirst({ where: { id, branchId } });
  if (!request) throw NotFound("Request not found");
  if (request.status !== "PENDING") throw DomainError(`Request is already ${request.status.toLowerCase()}`);
  const updated = await prisma.bloodRequest.update({ where: { id }, data: { status: "REJECTED", rejectReason: reason } });
  await writeAudit({ branchId, userId: ctx.userId, entity: "request", entityId: id, action: "REJECT", after: { reason } });
  return updated;
}

/** Cancels a request and releases all held reservations back into available stock. */
export async function cancelRequest(branchId: string, ctx: Ctx, id: string) {
  const request = await prisma.bloodRequest.findFirst({ where: { id, branchId } });
  if (!request) throw NotFound("Request not found");
  if (request.status === "COMPLETED" || request.status === "CANCELLED") {
    throw DomainError(`Request is already ${request.status.toLowerCase()}`);
  }

  await prisma.$transaction(async (tx) => {
    const held = await tx.reservation.findMany({
      where: { requestId: id, status: "HELD" },
      include: { component: { select: { id: true, status: true, version: true, bloodGroup: true, type: true } } },
    });
    for (const r of held) {
      const locked = await tx.bloodComponent.updateMany({
        where: { id: r.componentId, status: "RESERVED", version: r.component.version },
        data: { status: "AVAILABLE", version: { increment: 1 } },
      });
      await tx.reservation.update({ where: { id: r.id }, data: { status: "RELEASED" } });
      if (locked.count > 0) {
        await recordMovement(tx, r.componentId, "RELEASE", { refType: "REQUEST", refId: id, byUserId: ctx.userId });
        await adjustStock(tx, branchId, r.component.bloodGroup, r.component.type, { available: 1, reserved: -1 });
      }
    }
    await tx.bloodRequest.update({ where: { id }, data: { status: "CANCELLED" } });
    await writeAudit({ branchId, userId: ctx.userId, entity: "request", entityId: id, action: "CANCEL", after: { released: held.length } }, tx);
  });
}
