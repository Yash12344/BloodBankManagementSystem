import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as c from "./request.controller.js";

export const requestRouter = Router();

requestRouter.use(requireAuth);

requestRouter.get("/", requirePermission("requests", "view"), asyncHandler(c.list));
requestRouter.post("/", requirePermission("requests", "create"), asyncHandler(c.create));
requestRouter.get("/:id", requirePermission("requests", "view"), asyncHandler(c.getOne));
requestRouter.post("/:id/approve", requirePermission("requests", "approve"), asyncHandler(c.approve));
requestRouter.post("/:id/reject", requirePermission("requests", "approve"), asyncHandler(c.reject));
requestRouter.post("/:id/cancel", requirePermission("requests", "edit"), asyncHandler(c.cancel));
