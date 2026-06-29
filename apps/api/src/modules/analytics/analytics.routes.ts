import { Router, type Request, type Response } from "express";
import { Unauthorized } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as a from "./analytics.service.js";

function branch(req: Request): string {
  if (!req.user) throw Unauthorized();
  return req.user.branchId;
}

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

// Dashboard data is available to anyone who can see the dashboard.
const dash = requirePermission("dashboard", "view");
analyticsRouter.get("/summary", dash, asyncHandler(async (req: Request, res: Response) => {
  res.json(await a.summary(branch(req)));
}));
analyticsRouter.get("/blood-group-levels", dash, asyncHandler(async (req, res) => res.json({ data: await a.bloodGroupLevels(branch(req)) })));
analyticsRouter.get("/recent-activity", dash, asyncHandler(async (req, res) => res.json({ data: await a.recentActivity(branch(req)) })));
analyticsRouter.get("/expiring-units", dash, asyncHandler(async (req, res) => res.json({ data: await a.expiringUnits(branch(req)) })));
analyticsRouter.get("/collection-trends-dashboard", dash, asyncHandler(async (req, res) => res.json({ data: await a.collectionTrends(branch(req)) })));

const view = requirePermission("analytics", "view");
analyticsRouter.get("/collection-trends", view, asyncHandler(async (req, res) => res.json({ data: await a.collectionTrends(branch(req)) })));
analyticsRouter.get("/demand-by-group", view, asyncHandler(async (req, res) => res.json({ data: await a.demandByGroup(branch(req)) })));
analyticsRouter.get("/component-distribution", view, asyncHandler(async (req, res) => res.json({ data: await a.componentDistribution(branch(req)) })));
analyticsRouter.get("/top-donors", view, asyncHandler(async (req, res) => res.json({ data: await a.topDonors(branch(req)) })));
analyticsRouter.get("/top-hospitals", view, asyncHandler(async (req, res) => res.json({ data: await a.topHospitals(branch(req)) })));
analyticsRouter.get("/revenue", view, asyncHandler(async (req, res) => res.json({ data: await a.revenueTrend(branch(req)) })));
