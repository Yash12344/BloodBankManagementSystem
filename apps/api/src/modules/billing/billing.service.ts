import type { Paginated } from "@bloodline/types";
import { Prisma } from "@bloodline/db";
import { writeAudit, type AuditInput } from "../../lib/audit.js";
import { AppError, Conflict, DomainError, NotFound } from "../../lib/errors.js";
import { buildMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import type { ExpenseInput, ExpenseListQuery, InvoiceListQuery, PaymentInput, PriceListInput } from "./billing.dto.js";
import { invoiceStatusFor } from "./invoice.util.js";

type Ctx = Pick<AuditInput, "ip" | "userAgent"> & { userId: string };

export async function listInvoices(branchId: string, q: InvoiceListQuery): Promise<Paginated<unknown>> {
  const where: Prisma.InvoiceWhereInput = { branchId };
  if (q.status) where.status = q.status;
  if (q.hospitalId) where.hospitalId = q.hospitalId;
  if (q.dateFrom || q.dateTo) {
    const range: Prisma.DateTimeFilter = {};
    if (q.dateFrom) range.gte = q.dateFrom;
    if (q.dateTo) range.lte = q.dateTo;
    where.issuedAt = range;
  }

  const { skip, take } = toSkipTake(q.page, q.limit);
  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take,
      orderBy: { issuedAt: "desc" },
      include: { hospital: { select: { name: true } }, _count: { select: { payments: true } } },
    }),
    prisma.invoice.count({ where }),
  ]);
  return { data, meta: buildMeta(q.page, q.limit, total) };
}

export async function getInvoice(branchId: string, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, branchId },
    include: {
      lines: true,
      payments: { orderBy: { receivedAt: "desc" } },
      hospital: { select: { id: true, name: true, gstin: true } },
      issue: { select: { id: true, issuedAt: true } },
    },
  });
  if (!invoice) throw NotFound("Invoice not found");
  return invoice;
}

async function recomputeHospitalOutstanding(tx: Prisma.TransactionClient, branchId: string, hospitalId: string | null) {
  if (!hospitalId) return;
  const agg = await tx.invoice.aggregate({
    where: { branchId, hospitalId, status: { in: ["UNPAID", "PARTIAL"] } },
    _sum: { balanceMinor: true },
  });
  await tx.hospital.update({ where: { id: hospitalId }, data: { outstandingMinor: agg._sum.balanceMinor ?? 0 } });
}

/**
 * Records a payment idempotently. The Idempotency-Key maps to Payment.idempotencyKey
 * (unique), so a retried/double-submitted request returns the original payment instead of
 * charging twice. Invoice balance/status is recomputed from the authoritative sum of
 * payments under an optimistic version guard; the hospital's outstanding is kept in sync.
 */
export async function recordPayment(branchId: string, ctx: Ctx, invoiceId: string, input: PaymentInput, idempotencyKey: string) {
  // Fast path: this exact request was already processed.
  const prior = await prisma.payment.findUnique({ where: { idempotencyKey } });
  if (prior) {
    if (prior.invoiceId !== invoiceId) throw Conflict("Idempotency key already used for another invoice");
    return { payment: prior, invoice: await getInvoice(branchId, invoiceId) };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, branchId } });
        if (!invoice) throw NotFound("Invoice not found");
        if (invoice.status === "VOID") throw DomainError("Cannot pay a void invoice");

        const payment = await tx.payment.create({
          data: { invoiceId, method: input.method, amountMinor: input.amountMinor, reference: input.reference ?? null, idempotencyKey, receivedByUserId: ctx.userId },
        });

        const paidAgg = await tx.payment.aggregate({ where: { invoiceId }, _sum: { amountMinor: true } });
        const paid = paidAgg._sum.amountMinor ?? 0;
        const { balanceMinor, status } = invoiceStatusFor(invoice.totalMinor, paid);

        const updated = await tx.invoice.updateMany({
          where: { id: invoiceId, version: invoice.version },
          data: { balanceMinor, status, version: { increment: 1 } },
        });
        if (updated.count === 0) throw Conflict("Invoice changed concurrently; retry");

        await recomputeHospitalOutstanding(tx, branchId, invoice.hospitalId);
        await writeAudit({ branchId, userId: ctx.userId, entity: "invoice", entityId: invoiceId, action: "PAYMENT", after: { amountMinor: input.amountMinor, method: input.method, status } }, tx);

        return { payment, invoice: { ...invoice, balanceMinor, status } };
      });
    } catch (err) {
      // Concurrent double-submit with the same key: return the winner's payment.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
        if (existing) return { payment: existing, invoice: await getInvoice(branchId, invoiceId) };
      }
      // Retry only on the optimistic-concurrency conflict we raise above.
      if (err instanceof AppError && err.code === "CONFLICT" && attempt < 2) continue;
      throw err;
    }
  }
  throw Conflict("Could not record payment, please retry");
}

export async function voidInvoice(branchId: string, ctx: Ctx, id: string, reason: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id, branchId }, include: { _count: { select: { payments: true } } } });
  if (!invoice) throw NotFound("Invoice not found");
  if (invoice._count.payments > 0) throw DomainError("Cannot void an invoice that has payments");
  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.update({ where: { id }, data: { status: "VOID", balanceMinor: 0 } });
    await recomputeHospitalOutstanding(tx, branchId, invoice.hospitalId);
    await writeAudit({ branchId, userId: ctx.userId, entity: "invoice", entityId: id, action: "VOID", after: { reason } }, tx);
    return inv;
  });
  return updated;
}

// ---- Expenses ----
export async function listExpenses(branchId: string, q: ExpenseListQuery): Promise<Paginated<unknown>> {
  const where: Prisma.ExpenseWhereInput = { branchId };
  if (q.dateFrom || q.dateTo) {
    const range: Prisma.DateTimeFilter = {};
    if (q.dateFrom) range.gte = q.dateFrom;
    if (q.dateTo) range.lte = q.dateTo;
    where.spentAt = range;
  }
  const { skip, take } = toSkipTake(q.page, q.limit);
  const [data, total] = await Promise.all([
    prisma.expense.findMany({ where, skip, take, orderBy: { spentAt: "desc" } }),
    prisma.expense.count({ where }),
  ]);
  return { data, meta: buildMeta(q.page, q.limit, total) };
}

export async function createExpense(branchId: string, ctx: Ctx, input: ExpenseInput) {
  const expense = await prisma.expense.create({
    data: { branchId, head: input.head, amountMinor: input.amountMinor, spentAt: input.spentAt ?? new Date(), notes: input.notes ?? null, byUserId: ctx.userId },
  });
  await writeAudit({ branchId, userId: ctx.userId, entity: "expense", entityId: expense.id, action: "CREATE", after: expense });
  return expense;
}

// ---- Daily cash book ----
export async function dailyCash(branchId: string, date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const next = new Date(day.getTime() + 86_400_000);

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({ where: { invoice: { branchId }, receivedAt: { gte: day, lt: next } }, select: { method: true, amountMinor: true } }),
    prisma.expense.findMany({ where: { branchId, spentAt: { gte: day, lt: next } }, select: { amountMinor: true } }),
  ]);

  const byMethod: Record<string, number> = {};
  let totalIn = 0;
  for (const p of payments) {
    byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amountMinor;
    totalIn += p.amountMinor;
  }
  const totalExpense = expenses.reduce((s, e) => s + e.amountMinor, 0);
  return { date: day.toISOString().slice(0, 10), byMethod, totalIn, totalExpense, net: totalIn - totalExpense };
}

// ---- Aging ----
export async function aging(branchId: string) {
  const open = await prisma.invoice.findMany({
    where: { branchId, status: { in: ["UNPAID", "PARTIAL"] } },
    select: { balanceMinor: true, issuedAt: true, hospitalId: true },
  });
  const now = Date.now();
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const inv of open) {
    const days = (now - inv.issuedAt.getTime()) / 86_400_000;
    if (days <= 30) buckets["0-30"] += inv.balanceMinor;
    else if (days <= 60) buckets["31-60"] += inv.balanceMinor;
    else if (days <= 90) buckets["61-90"] += inv.balanceMinor;
    else buckets["90+"] += inv.balanceMinor;
  }
  return { buckets, totalOutstanding: open.reduce((s, i) => s + i.balanceMinor, 0) };
}

// ---- Price list ----
export async function getPriceList(branchId: string) {
  return prisma.priceListItem.findMany({ where: { branchId }, orderBy: [{ componentType: "asc" }, { bloodGroup: "asc" }] });
}

export async function updatePriceList(branchId: string, ctx: Ctx, input: PriceListInput) {
  // Upsert by hand: Prisma cannot match a NULL bloodGroup through the composite unique,
  // so we look the row up explicitly and update or create it.
  await prisma.$transaction(async (tx) => {
    for (const item of input.items) {
      const group = item.bloodGroup ?? null;
      const existing = await tx.priceListItem.findFirst({
        where: { branchId, componentType: item.componentType, bloodGroup: group },
        select: { id: true },
      });
      if (existing) {
        await tx.priceListItem.update({ where: { id: existing.id }, data: { priceMinor: item.priceMinor, gstRate: item.gstRate } });
      } else {
        await tx.priceListItem.create({ data: { branchId, componentType: item.componentType, bloodGroup: group, priceMinor: item.priceMinor, gstRate: item.gstRate } });
      }
    }
  });
  await writeAudit({ branchId, userId: ctx.userId, entity: "price_list", entityId: branchId, action: "UPDATE", after: { count: input.items.length } });
  return getPriceList(branchId);
}
