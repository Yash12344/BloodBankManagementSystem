import type { Paginated } from "@bloodline/types";
import type { BloodGroup, ComponentType, Prisma } from "@bloodline/db";
import { writeAudit, type AuditInput } from "../../lib/audit.js";
import { evaluateCompatibility } from "../../lib/bloodCompatibility.js";
import { Conflict, DomainError, NotFound } from "../../lib/errors.js";
import { buildMeta, parseSort, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import { computeInvoiceTotals, type InvoiceLineInput } from "../billing/invoice.util.js";
import { adjustStock, recordMovement } from "../inventory/stock.js";
import { withinColdChainWindow } from "./coldchain.js";
import type { CrossMatchInput, IssueCreateInput, IssueListQuery } from "./issue.dto.js";

type Ctx = Pick<AuditInput, "ip" | "userAgent"> & { userId: string };

const ISSUE_SORTABLE = ["issuedAt", "status"] as const;

export async function createCrossMatch(branchId: string, ctx: Ctx, input: CrossMatchInput) {
  const request = await prisma.bloodRequest.findFirst({
    where: { id: input.requestId, branchId },
    select: { id: true, bloodGroup: true, patient: { select: { bloodGroup: true } } },
  });
  if (!request) throw NotFound("Request not found");
  const component = await prisma.bloodComponent.findFirst({
    where: { id: input.componentId, branchId },
    select: { id: true, bloodGroup: true, type: true },
  });
  if (!component) throw NotFound("Component not found");

  // Patient-safety gate: the donor unit must be ABO/Rh compatible with the recipient. A
  // COMPATIBLE result can never be recorded against a serologically incompatible pairing.
  const recipientGroup = request.patient?.bloodGroup ?? request.bloodGroup;
  const compat = evaluateCompatibility(component.bloodGroup, recipientGroup, component.type);
  if (input.result === "COMPATIBLE" && !compat.compatible) {
    throw DomainError(`Cannot record a COMPATIBLE cross-match: ${compat.reason}`, {
      donorGroup: component.bloodGroup,
      recipientGroup,
    });
  }

  const crossMatch = await prisma.crossMatch.create({
    data: {
      requestId: input.requestId,
      componentId: input.componentId,
      patientSampleRef: input.patientSampleRef ?? null,
      result: input.result,
      technicianId: ctx.userId,
    },
  });
  await writeAudit({ branchId, userId: ctx.userId, entity: "crossmatch", entityId: crossMatch.id, action: "CREATE", after: { ...crossMatch, compatibility: compat } });
  return crossMatch;
}

async function nextInvoiceNumber(tx: Prisma.TransactionClient, branchId: string): Promise<string> {
  const count = await tx.invoice.count({ where: { branchId } });
  return `INV-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, "0")}`;
}

/**
 * Issues blood against an approved request. Server-side guard rails (all enforced here,
 * not just in the UI): the unit must be reserved for THIS request, have a COMPATIBLE
 * cross-match, and not be expired. The whole hand-over is one transaction — components are
 * moved RESERVED→ISSUED under an optimistic version guard (no double-issue), stock counters
 * and the ledger update, reservations are consumed, the request completes when fully
 * fulfilled, and a DRAFT invoice is generated from the price list.
 */
export async function createIssue(branchId: string, ctx: Ctx, input: IssueCreateInput) {
  const request = await prisma.bloodRequest.findFirst({
    where: { id: input.requestId, branchId },
    include: { patient: { select: { bloodGroup: true } } },
  });
  if (!request) throw NotFound("Request not found");
  if (request.status !== "APPROVED") throw DomainError("Only an approved request can be issued against");

  // Recipient group for the final ABO/Rh safety gate (patient's recorded group wins).
  const recipientGroup = request.patient?.bloodGroup ?? request.bloodGroup;

  const components = await prisma.bloodComponent.findMany({
    where: { branchId, barcode: { in: input.componentBarcodes } },
  });
  const byBarcode = new Map(components.map((c) => [c.barcode, c]));

  // Validate every scanned barcode up front; collect all problems for a clear error.
  const now = new Date();
  const problems: string[] = [];
  const resolved: { componentId: string; crossMatchId: string; bloodGroup: BloodGroup; type: ComponentType }[] = [];

  for (const barcode of input.componentBarcodes) {
    const comp = byBarcode.get(barcode);
    if (!comp) {
      problems.push(`${barcode}: not found`);
      continue;
    }
    if (comp.status !== "RESERVED") problems.push(`${barcode}: status is ${comp.status}, expected RESERVED`);
    if (comp.expiresAt <= now) problems.push(`${barcode}: expired`);

    const reservation = await prisma.reservation.findFirst({
      where: { requestId: input.requestId, componentId: comp.id, status: "HELD" },
      select: { id: true },
    });
    if (!reservation) problems.push(`${barcode}: not reserved for this request`);

    const crossMatch = await prisma.crossMatch.findFirst({
      where: { requestId: input.requestId, componentId: comp.id, result: "COMPATIBLE" },
      orderBy: { performedAt: "desc" },
      select: { id: true },
    });
    if (!crossMatch) problems.push(`${barcode}: no compatible cross-match`);

    // Final ABO/Rh safety gate — enforced even if a cross-match record claims COMPATIBLE.
    const compat = evaluateCompatibility(comp.bloodGroup, recipientGroup, comp.type);
    if (!compat.compatible) problems.push(`${barcode}: ${compat.reason}`);

    if (comp.status === "RESERVED" && comp.expiresAt > now && reservation && crossMatch && compat.compatible) {
      resolved.push({ componentId: comp.id, crossMatchId: crossMatch.id, bloodGroup: comp.bloodGroup, type: comp.type });
    }
  }

  if (problems.length > 0) throw DomainError("Cannot issue: validation failed", { problems });

  // Price the components from the branch price list.
  const priceItems = await prisma.priceListItem.findMany({ where: { branchId } });
  const priceFor = (type: ComponentType, group: BloodGroup) => {
    const specific = priceItems.find((p) => p.componentType === type && p.bloodGroup === group);
    const generic = priceItems.find((p) => p.componentType === type && p.bloodGroup === null);
    const item = specific ?? generic;
    return { priceMinor: item?.priceMinor ?? 0, gstRate: item?.gstRate ?? 0 };
  };

  const result = await prisma.$transaction(async (tx) => {
    const issue = await tx.issue.create({
      data: {
        branchId,
        requestId: input.requestId,
        patientId: request.patientId,
        hospitalId: request.hospitalId,
        issuedByUserId: ctx.userId,
        status: "ISSUED",
      },
    });

    const lines: InvoiceLineInput[] = [];
    for (const r of resolved) {
      // Optimistic move RESERVED → ISSUED; fail the whole tx if contended.
      const comp = await tx.bloodComponent.findUniqueOrThrow({ where: { id: r.componentId }, select: { version: true } });
      const moved = await tx.bloodComponent.updateMany({
        where: { id: r.componentId, status: "RESERVED", version: comp.version },
        data: { status: "ISSUED", version: { increment: 1 } },
      });
      if (moved.count === 0) throw Conflict("A unit was modified concurrently; please re-scan and retry");

      const { priceMinor, gstRate } = priceFor(r.type, r.bloodGroup);
      await tx.issueItem.create({ data: { issueId: issue.id, componentId: r.componentId, crossMatchId: r.crossMatchId, priceMinor } });
      await recordMovement(tx, r.componentId, "ISSUE", { refType: "ISSUE", refId: issue.id, byUserId: ctx.userId });
      await adjustStock(tx, branchId, r.bloodGroup, r.type, { reserved: -1, issued: 1 });
      await tx.reservation.updateMany({ where: { requestId: input.requestId, componentId: r.componentId, status: "HELD" }, data: { status: "CONSUMED" } });

      lines.push({ description: `${r.type} ${r.bloodGroup}`, qty: 1, unitPriceMinor: priceMinor, gstRate });
    }

    const totals = computeInvoiceTotals(lines);
    const invoice = await tx.invoice.create({
      data: {
        branchId,
        issueId: issue.id,
        hospitalId: request.hospitalId,
        patientId: request.patientId,
        number: await nextInvoiceNumber(tx, branchId),
        status: "DRAFT",
        subtotalMinor: totals.subtotalMinor,
        gstMinor: totals.gstMinor,
        totalMinor: totals.totalMinor,
        balanceMinor: totals.totalMinor,
        lines: {
          create: lines.map((l) => ({
            description: l.description,
            qty: l.qty,
            unitPriceMinor: l.unitPriceMinor,
            gstRate: l.gstRate,
            amountMinor: l.unitPriceMinor * l.qty,
          })),
        },
      },
    });

    const slipUrl = `/api/v1/issues/${issue.id}/slip`;
    await tx.issue.update({ where: { id: issue.id }, data: { slipUrl } });

    // Complete the request if nothing is still held against it.
    const remaining = await tx.reservation.count({ where: { requestId: input.requestId, status: "HELD" } });
    if (remaining === 0) {
      await tx.bloodRequest.update({ where: { id: input.requestId }, data: { status: "COMPLETED" } });
    }

    await writeAudit({ branchId, userId: ctx.userId, entity: "issue", entityId: issue.id, action: "ISSUE", after: { components: resolved.length, invoice: invoice.number } }, tx);
    return { issue: { ...issue, slipUrl }, invoice };
  });

  return result;
}

/**
 * Returns an issued unit set from the hospital. Components returned within the cold-chain
 * window can re-enter stock (RETURN movement, issued→available); otherwise they are
 * discarded. Ledger and counters update transactionally; the issue is marked RETURNED.
 */
export async function returnIssue(branchId: string, ctx: Ctx, issueId: string, restock: boolean, reason?: string) {
  const issue = await prisma.issue.findFirst({
    where: { id: issueId, branchId },
    include: { items: { include: { component: { select: { id: true, status: true, version: true, bloodGroup: true, type: true } } } } },
  });
  if (!issue) throw NotFound("Issue not found");
  if (issue.status !== "ISSUED") throw DomainError(`Issue is already ${issue.status.toLowerCase()}`);

  const canRestock = restock && withinColdChainWindow(issue.issuedAt, new Date());

  const result = await prisma.$transaction(async (tx) => {
    let restocked = 0;
    let discarded = 0;
    for (const item of issue.items) {
      const comp = item.component;
      if (comp.status !== "ISSUED") continue;

      if (canRestock) {
        const moved = await tx.bloodComponent.updateMany({ where: { id: comp.id, status: "ISSUED", version: comp.version }, data: { status: "AVAILABLE", version: { increment: 1 } } });
        if (moved.count === 0) throw Conflict("A unit changed concurrently; retry");
        await recordMovement(tx, comp.id, "RETURN", { refType: "RETURN", refId: issueId, byUserId: ctx.userId });
        await adjustStock(tx, branchId, comp.bloodGroup, comp.type, { issued: -1, available: 1 });
        restocked++;
      } else {
        const moved = await tx.bloodComponent.updateMany({ where: { id: comp.id, status: "ISSUED", version: comp.version }, data: { status: "DISCARDED", version: { increment: 1 } } });
        if (moved.count === 0) throw Conflict("A unit changed concurrently; retry");
        await recordMovement(tx, comp.id, "DISCARD", { refType: "RETURN", refId: issueId, byUserId: ctx.userId });
        await adjustStock(tx, branchId, comp.bloodGroup, comp.type, { issued: -1, discarded: 1 });
        discarded++;
      }
    }
    await tx.issue.update({ where: { id: issueId }, data: { status: "RETURNED" } });
    await writeAudit({ branchId, userId: ctx.userId, entity: "issue", entityId: issueId, action: "RETURN", after: { restocked, discarded, withinColdChain: canRestock, reason } }, tx);
    return { restocked, discarded, restockEligible: canRestock };
  });

  return result;
}

export async function listIssues(branchId: string, q: IssueListQuery): Promise<Paginated<unknown>> {
  const where: Prisma.IssueWhereInput = { branchId };
  if (q.status) where.status = q.status;
  if (q.hospitalId) where.hospitalId = q.hospitalId;
  if (q.patientId) where.patientId = q.patientId;
  if (q.dateFrom || q.dateTo) {
    const range: Prisma.DateTimeFilter = {};
    if (q.dateFrom) range.gte = q.dateFrom;
    if (q.dateTo) range.lte = q.dateTo;
    where.issuedAt = range;
  }

  const { skip, take } = toSkipTake(q.page, q.limit);
  const [rows, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      skip,
      take,
      orderBy: parseSort(q.sort, ISSUE_SORTABLE, { issuedAt: "desc" }) as Prisma.IssueOrderByWithRelationInput,
      include: {
        patient: { select: { name: true } },
        hospital: { select: { name: true } },
        invoice: { select: { number: true, totalMinor: true, status: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.issue.count({ where }),
  ]);

  return { data: rows, meta: buildMeta(q.page, q.limit, total) };
}

export async function getIssue(branchId: string, id: string) {
  const issue = await prisma.issue.findFirst({
    where: { id, branchId },
    include: {
      items: { include: { component: { select: { barcode: true, type: true, bloodGroup: true } } } },
      patient: { select: { name: true } },
      hospital: { select: { name: true } },
      invoice: true,
    },
  });
  if (!issue) throw NotFound("Issue not found");
  return issue;
}
