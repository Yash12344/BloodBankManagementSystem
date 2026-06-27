import type { Request, Response } from "express";
import { Unauthorized } from "../../lib/errors.js";
import * as labService from "./lab.service.js";
import { labRejectSchema, labTestsSchema, labWorklistSchema } from "./lab.dto.js";

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return {
    branchId: req.user.branchId,
    ctx: { userId: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
  };
}

export async function worklist(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await labService.worklist(branchId, labWorklistSchema.parse(req.query)));
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ lab: await labService.getLab(branchId, req.params.unitId as string) });
}

export async function recordTests(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const input = labTestsSchema.parse(req.body);
  res.json({ lab: await labService.recordTests(branchId, ctx, req.params.unitId as string, input) });
}

export async function approve(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.json({ lab: await labService.approve(branchId, ctx, req.params.unitId as string) });
}

export async function reject(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const { reason } = labRejectSchema.parse(req.body);
  await labService.reject(branchId, ctx, req.params.unitId as string, reason);
  res.status(204).send();
}
