import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { toCsv } from "../../lib/csv.js";
import { toPdfBuffer } from "../../lib/pdf.js";
import { toXlsxBuffer } from "../../lib/xlsx.js";
import { BadRequest, Unauthorized } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { buildReport, REPORT_TYPES } from "./report.service.js";

const querySchema = z.object({
  format: z.enum(["csv", "json", "xlsx", "pdf"]).default("json"),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

    if (format === "xlsx") {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${type}-report.xlsx"`);
      res.send(await toXlsxBuffer(report));
      return;
    }

    if (format === "pdf") {
      const range =
        dateFrom || dateTo
          ? `${dateFrom ? dateFrom.toISOString().slice(0, 10) : "…"} to ${dateTo ? dateTo.toISOString().slice(0, 10) : "…"}`
          : undefined;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${type}-report.pdf"`);
      res.send(await toPdfBuffer(report, { title: titleCase(type), range }));
      return;
    }

    res.json(report);
  }),
);
