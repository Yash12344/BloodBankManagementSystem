import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Unauthorized } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as service from "./settings.service.js";

function branch(req: Request): string {
  if (!req.user) throw Unauthorized();
  return req.user.branchId;
}

const view = requirePermission("settings", "view");
const pageSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) });

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get("/organization", view, asyncHandler(async (req: Request, res: Response) => {
  res.json({ organization: await service.getOrganization(branch(req)) });
}));

settingsRouter.get("/users", view, asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await service.listUsers(branch(req)) });
}));

settingsRouter.get("/permissions", view, asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: await service.permissionMatrix() });
}));

settingsRouter.get("/audit-logs", view, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = pageSchema.parse(req.query);
  res.json(await service.listAuditLogs(branch(req), page, limit));
}));
