import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as c from "./camp.controller.js";

export const campRouter = Router();

campRouter.use(requireAuth);

campRouter.get("/", requirePermission("camps", "view"), asyncHandler(c.list));
campRouter.post("/", requirePermission("camps", "create"), asyncHandler(c.create));
campRouter.get("/:id", requirePermission("camps", "view"), asyncHandler(c.getOne));
campRouter.patch("/:id", requirePermission("camps", "edit"), asyncHandler(c.update));
campRouter.get("/:id/stats", requirePermission("camps", "view"), asyncHandler(c.stats));
campRouter.post("/:id/volunteers", requirePermission("camps", "edit"), asyncHandler(c.addVolunteer));
campRouter.post("/:id/expenses", requirePermission("camps", "edit"), asyncHandler(c.addExpense));
campRouter.post("/:id/remind", requirePermission("camps", "edit"), asyncHandler(c.remind));
