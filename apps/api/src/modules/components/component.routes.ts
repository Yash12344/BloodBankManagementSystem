import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as c from "./component.controller.js";

export const componentRouter = Router();

componentRouter.use(requireAuth);

// Separate an approved unit into components (specific routes before the :id catch-all).
componentRouter.post("/separate/:unitId", requirePermission("components", "create"), asyncHandler(c.separate));
componentRouter.get("/barcode/:barcode", requirePermission("components", "view"), asyncHandler(c.getByBarcode));
componentRouter.get("/:id", requirePermission("components", "view"), asyncHandler(c.getOne));
componentRouter.post("/:id/discard", requirePermission("components", "delete"), asyncHandler(c.discard));
