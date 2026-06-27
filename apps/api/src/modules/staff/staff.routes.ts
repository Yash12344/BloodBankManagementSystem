import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as c from "./staff.controller.js";

export const staffRouter = Router();

staffRouter.use(requireAuth);

staffRouter.get("/", requirePermission("staff", "view"), asyncHandler(c.list));
staffRouter.get("/:id", requirePermission("staff", "view"), asyncHandler(c.getOne));
staffRouter.put("/:id/profile", requirePermission("staff", "edit"), asyncHandler(c.upsertProfile));
staffRouter.post("/:id/attendance", requirePermission("staff", "edit"), asyncHandler(c.markAttendance));
staffRouter.post("/:id/leaves", requirePermission("staff", "edit"), asyncHandler(c.requestLeave));
staffRouter.patch("/leaves/:leaveId", requirePermission("staff", "edit"), asyncHandler(c.setLeaveStatus));
staffRouter.get("/:id/activity", requirePermission("staff", "view"), asyncHandler(c.activity));
