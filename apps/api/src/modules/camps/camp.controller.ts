import type { Request, Response } from "express";
import { Unauthorized } from "../../lib/errors.js";
import * as campService from "./camp.service.js";
import { campCreateSchema, campListSchema, campUpdateSchema, expenseSchema, volunteerSchema } from "./camp.dto.js";

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return {
    branchId: req.user.branchId,
    ctx: { userId: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
  };
}

export async function list(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await campService.listCamps(branchId, campListSchema.parse(req.query)));
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ camp: await campService.getCamp(branchId, req.params.id as string) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.status(201).json({ camp: await campService.createCamp(branchId, ctx, campCreateSchema.parse(req.body)) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.json({ camp: await campService.updateCamp(branchId, ctx, req.params.id as string, campUpdateSchema.parse(req.body)) });
}

export async function addVolunteer(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.status(201).json({ volunteer: await campService.addVolunteer(branchId, ctx, req.params.id as string, volunteerSchema.parse(req.body)) });
}

export async function addExpense(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.status(201).json({ expense: await campService.addExpense(branchId, ctx, req.params.id as string, expenseSchema.parse(req.body)) });
}

export async function stats(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await campService.campStats(branchId, req.params.id as string));
}

export async function remind(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.json(await campService.remindCamp(branchId, ctx, req.params.id as string));
}
