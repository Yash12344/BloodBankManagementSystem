import { bloodGroupSchema, componentTypeSchema } from "@bloodline/types";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { aiEnabled } from "../../lib/ai.js";
import { BadRequest, Unauthorized } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as ai from "./ai.service.js";

function branch(req: Request): string {
  if (!req.user) throw Unauthorized();
  return req.user.branchId;
}

const view = requirePermission("analytics", "view");

export const aiRouter = Router();
aiRouter.use(requireAuth);

aiRouter.get("/status", asyncHandler(async (_req: Request, res: Response) => {
  res.json({ enabled: aiEnabled() });
}));

aiRouter.get("/low-stock-forecast", view, asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await ai.lowStockForecast(branch(req)) });
}));

aiRouter.get("/demand-forecast", view, asyncHandler(async (req: Request, res: Response) => {
  const q = z
    .object({ bloodGroup: bloodGroupSchema, componentType: componentTypeSchema, days: z.coerce.number().int().min(1).max(90).default(14) })
    .parse(req.query);
  res.json(await ai.demandForecast(branch(req), q.bloodGroup, q.componentType, q.days));
}));

aiRouter.get("/donor-suggestions", view, asyncHandler(async (req: Request, res: Response) => {
  const q = z.object({ bloodGroup: bloodGroupSchema }).parse(req.query);
  res.json({ data: await ai.suggestDonors(branch(req), q.bloodGroup) });
}));

aiRouter.post("/search", asyncHandler(async (req: Request, res: Response) => {
  branch(req); // require auth
  const { query } = z.object({ query: z.string().trim().min(1).max(200) }).parse(req.body);
  res.json(await ai.nlSearch(query));
}));

aiRouter.get("/report-summary/:type", view, asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = z.object({ dateFrom: z.coerce.date().optional(), dateTo: z.coerce.date().optional() }).parse(req.query);
  const type = req.params.type as string;
  if (!type) throw BadRequest("type is required");
  res.json(await ai.reportSummary(branch(req), type, { from: dateFrom, to: dateTo }));
}));
