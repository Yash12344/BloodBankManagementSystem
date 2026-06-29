import type { Request, Response } from "express";
import { Unauthorized } from "../../lib/errors.js";
import * as issueService from "./issue.service.js";
import { crossMatchSchema, issueCreateSchema, issueListSchema, issueReturnSchema } from "./issue.dto.js";

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return {
    branchId: req.user.branchId,
    ctx: { userId: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
  };
}

export async function crossMatch(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.status(201).json({ crossMatch: await issueService.createCrossMatch(branchId, ctx, crossMatchSchema.parse(req.body)) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.status(201).json(await issueService.createIssue(branchId, ctx, issueCreateSchema.parse(req.body)));
}

export async function list(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await issueService.listIssues(branchId, issueListSchema.parse(req.query)));
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ issue: await issueService.getIssue(branchId, req.params.id as string) });
}

export async function returnIssue(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const { restock, reason } = issueReturnSchema.parse(req.body);
  res.json(await issueService.returnIssue(branchId, ctx, req.params.id as string, restock, reason));
}
