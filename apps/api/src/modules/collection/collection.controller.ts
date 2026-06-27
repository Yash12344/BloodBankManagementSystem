import type { Request, Response } from "express";
import { Unauthorized } from "../../lib/errors.js";
import * as collectionService from "./collection.service.js";
import { collectionCreateSchema, collectionListSchema, collectionStatusSchema } from "./collection.dto.js";

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return {
    branchId: req.user.branchId,
    ctx: { userId: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
  };
}

export async function create(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const input = collectionCreateSchema.parse(req.body);
  res.status(201).json(await collectionService.createCollection(branchId, ctx, input));
}

export async function list(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await collectionService.listCollections(branchId, collectionListSchema.parse(req.query)));
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ collection: await collectionService.getCollection(branchId, req.params.id as string) });
}

export async function setStatus(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const { status } = collectionStatusSchema.parse(req.body);
  res.json({ collection: await collectionService.updateStatus(branchId, ctx, req.params.id as string, status) });
}
