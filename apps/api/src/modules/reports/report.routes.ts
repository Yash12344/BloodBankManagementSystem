import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { toCsv } from "../../lib/csv.js";
import { BadRequest, Unauthorized } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { buildReport, REPORT_TYPES } from "./report.service.js";

const querySchema = z.object({
  format: z.enum(["csv", "json"]).default("json"),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const reportRouter = Router();
reportRouter.use(requireAuth);

reportRouter.get(
  "/:type",
  requirePermission("reports", "view"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw Unauthorized();
    const type = req.params.type as string;
    if (!(REPORT_TYPES as readonly string[]).includes(type)) throw BadRequest(`Unknown report type: ${type}`);

    const { format, dateFrom, dateTo } = querySchema.parse(req.query);
    const report = await buildReport(req.user.branchId, type as (typeof REPORT_TYPES)[number], { from: dateFrom, to: dateTo });

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${type}-report.csv"`);
      res.send(toCsv(report.headers, report.rows));
      return;
    }
    res.json(report);
  }),
);
