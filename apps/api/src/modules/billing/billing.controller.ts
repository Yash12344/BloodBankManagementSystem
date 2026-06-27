import type { Request, Response } from "express";
import { BadRequest, Unauthorized } from "../../lib/errors.js";
import * as billingService from "./billing.service.js";
import {
  dailyCashSchema,
  expenseCreateSchema,
  expenseListSchema,
  invoiceListSchema,
  paymentSchema,
  priceListSchema,
  voidSchema,
} from "./billing.dto.js";

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return {
    branchId: req.user.branchId,
    ctx: { userId: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
  };
}

export async function listInvoices(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await billingService.listInvoices(branchId, invoiceListSchema.parse(req.query)));
}

export async function getInvoice(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ invoice: await billingService.getInvoice(branchId, req.params.id as string) });
}

export async function recordPayment(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const idempotencyKey = req.header("Idempotency-Key");
  if (!idempotencyKey) throw BadRequest("Idempotency-Key header is required for payments");
  const input = paymentSchema.parse(req.body);
  res.status(201).json(await billingService.recordPayment(branchId, ctx, req.params.id as string, input, idempotencyKey));
}

export async function voidInvoice(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const { reason } = voidSchema.parse(req.body);
  res.json({ invoice: await billingService.voidInvoice(branchId, ctx, req.params.id as string, reason) });
}

export async function listExpenses(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await billingService.listExpenses(branchId, expenseListSchema.parse(req.query)));
}

export async function createExpense(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.status(201).json({ expense: await billingService.createExpense(branchId, ctx, expenseCreateSchema.parse(req.body)) });
}

export async function dailyCash(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  const { date } = dailyCashSchema.parse(req.query);
  res.json(await billingService.dailyCash(branchId, date ?? new Date()));
}

export async function aging(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await billingService.aging(branchId));
}

export async function getPriceList(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ data: await billingService.getPriceList(branchId) });
}

export async function updatePriceList(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.json({ data: await billingService.updatePriceList(branchId, ctx, priceListSchema.parse(req.body)) });
}
