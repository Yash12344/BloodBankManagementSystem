import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as c from "./collection.controller.js";

export const collectionRouter = Router();

collectionRouter.use(requireAuth);

collectionRouter.get("/", requirePermission("collection", "view"), asyncHandler(c.list));
collectionRouter.post("/", requirePermission("collection", "create"), asyncHandler(c.create));
collectionRouter.get("/:id", requirePermission("collection", "view"), asyncHandler(c.getOne));
collectionRouter.patch("/:id/status", requirePermission("collection", "edit"), asyncHandler(c.setStatus));
