import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Unauthorized } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as service from "./lookback.service.js";

const recallSchema = z.object({ reason: z.string().trim().min(3).max(500) });

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return {
    branchId: req.user.branchId,
    ctx: { userId: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
  };
}

export const lookbackRouter = Router();
lookbackRouter.use(requireAuth);

// Tracing is a view; executing a recall is a clinical action gated to lab-approvers (doctors).
lookbackRouter.get("/:donorId/trace", requirePermission("donors", "view"), asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = auth(req);
  res.json(await service.traceDonor(branchId, req.params.donorId as string));
}));

lookbackRouter.post("/:donorId/recall", requirePermission("lab", "approve"), asyncHandler(async (req: Request, res: Response) => {
  const { branchId, ctx } = auth(req);
  const { reason } = recallSchema.parse(req.body);
  res.json(await service.recallDonor(branchId, ctx, req.params.donorId as string, reason));
}));
