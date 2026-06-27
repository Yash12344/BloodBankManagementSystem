import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as c from "./lab.controller.js";

export const labRouter = Router();

labRouter.use(requireAuth);

labRouter.get("/worklist", requirePermission("lab", "view"), asyncHandler(c.worklist));
labRouter.get("/:unitId", requirePermission("lab", "view"), asyncHandler(c.getOne));
labRouter.put("/:unitId/tests", requirePermission("lab", "edit"), asyncHandler(c.recordTests));
labRouter.post("/:unitId/approve", requirePermission("lab", "approve"), asyncHandler(c.approve));
labRouter.post("/:unitId/reject", requirePermission("lab", "approve"), asyncHandler(c.reject));
