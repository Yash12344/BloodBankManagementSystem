import type { Request, Response } from "express";
import { Unauthorized } from "../../lib/errors.js";
import * as requestService from "./request.service.js";
import { requestCreateSchema, requestListSchema, requestRejectSchema } from "./request.dto.js";

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return {
    branchId: req.user.branchId,
    ctx: { userId: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
  };
}

export async function list(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await requestService.listRequests(branchId, requestListSchema.parse(req.query)));
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ request: await requestService.getRequest(branchId, req.params.id as string) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.status(201).json({ request: await requestService.createRequest(branchId, ctx, requestCreateSchema.parse(req.body)) });
}

export async function approve(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.json(await requestService.approveRequest(branchId, ctx, req.params.id as string));
}

export async function reject(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const { reason } = requestRejectSchema.parse(req.body);
  res.json({ request: await requestService.rejectRequest(branchId, ctx, req.params.id as string, reason) });
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  await requestService.cancelRequest(branchId, ctx, req.params.id as string);
  res.status(204).send();
}
