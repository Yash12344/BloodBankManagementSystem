import express, { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as c from "./donor.controller.js";

export const donorRouter = Router();

donorRouter.use(requireAuth);

donorRouter.get("/", requirePermission("donors", "view"), asyncHandler(c.list));
donorRouter.get("/export", requirePermission("donors", "export"), asyncHandler(c.exportCsv));
donorRouter.post(
  "/import",
  requirePermission("donors", "import"),
  express.text({ type: ["text/csv", "text/plain"], limit: "5mb" }),
  asyncHandler(c.importCsv),
);
donorRouter.post("/", requirePermission("donors", "create"), asyncHandler(c.create));
donorRouter.get("/:id", requirePermission("donors", "view"), asyncHandler(c.getOne));
donorRouter.patch("/:id", requirePermission("donors", "edit"), asyncHandler(c.update));
donorRouter.delete("/:id", requirePermission("donors", "delete"), asyncHandler(c.remove));
donorRouter.get("/:id/donations", requirePermission("donors", "view"), asyncHandler(c.donations));
donorRouter.get("/:id/card", requirePermission("donors", "view"), asyncHandler(c.card));
donorRouter.post("/:id/deferrals", requirePermission("donors", "edit"), asyncHandler(c.defer));
