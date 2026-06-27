import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as c from "./patient.controller.js";

export const patientRouter = Router();

patientRouter.use(requireAuth);

patientRouter.get("/", requirePermission("patients", "view"), asyncHandler(c.list));
patientRouter.post("/", requirePermission("patients", "create"), asyncHandler(c.create));
patientRouter.get("/:id", requirePermission("patients", "view"), asyncHandler(c.getOne));
patientRouter.patch("/:id", requirePermission("patients", "edit"), asyncHandler(c.update));
patientRouter.delete("/:id", requirePermission("patients", "delete"), asyncHandler(c.remove));
