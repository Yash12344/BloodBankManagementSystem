import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as c from "./issue.controller.js";

export const issueRouter = Router();
issueRouter.use(requireAuth);
issueRouter.post("/", requirePermission("issue", "create"), asyncHandler(c.create));
issueRouter.get("/:id", requirePermission("issue", "view"), asyncHandler(c.getOne));
issueRouter.post("/:id/return", requirePermission("issue", "create"), asyncHandler(c.returnIssue));

// Cross-match is a laboratory activity, mounted separately at /crossmatch.
export const crossMatchRouter = Router();
crossMatchRouter.use(requireAuth);
crossMatchRouter.post("/", requirePermission("lab", "edit"), asyncHandler(c.crossMatch));
