import type { Request, Response } from "express";
import { Unauthorized } from "../../lib/errors.js";
import * as componentService from "./component.service.js";
import { discardSchema, separateSchema } from "./component.dto.js";

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return {
    branchId: req.user.branchId,
    ctx: { userId: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
  };
}

export async function separate(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const input = separateSchema.parse(req.body);
  res.status(201).json({ components: await componentService.separate(branchId, ctx, req.params.unitId as string, input) });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ component: await componentService.getComponent(branchId, req.params.id as string) });
}

export async function getByBarcode(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ component: await componentService.getByBarcode(branchId, req.params.barcode as string) });
}

export async function discard(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const { reason } = discardSchema.parse(req.body);
  await componentService.discard(branchId, ctx, req.params.id as string, reason);
  res.status(204).send();
}
