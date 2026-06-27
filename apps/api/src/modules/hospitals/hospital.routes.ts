import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as c from "./hospital.controller.js";

export const hospitalRouter = Router();

hospitalRouter.use(requireAuth);

hospitalRouter.get("/", requirePermission("hospitals", "view"), asyncHandler(c.list));
hospitalRouter.post("/", requirePermission("hospitals", "create"), asyncHandler(c.create));
hospitalRouter.get("/:id", requirePermission("hospitals", "view"), asyncHandler(c.getOne));
hospitalRouter.patch("/:id", requirePermission("hospitals", "edit"), asyncHandler(c.update));
hospitalRouter.delete("/:id", requirePermission("hospitals", "delete"), asyncHandler(c.remove));
hospitalRouter.post("/:id/doctors", requirePermission("hospitals", "edit"), asyncHandler(c.addDoctor));
hospitalRouter.get("/:id/history", requirePermission("hospitals", "view"), asyncHandler(c.history));
hospitalRouter.get("/:id/outstanding", requirePermission("hospitals", "view"), asyncHandler(c.outstanding));
