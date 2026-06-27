import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { Unauthorized } from "../../lib/errors.js";
import type { Request, Response } from "express";
import * as service from "./notification.service.js";

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return { branchId: req.user.branchId, userId: req.user.id };
}

export const notificationRouter = Router();
notificationRouter.use(requireAuth);

notificationRouter.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { branchId, userId } = auth(req);
    res.json({ data: await service.listNotifications(branchId, userId, req.query.unread === "true") });
  }),
);

notificationRouter.get(
  "/unread-count",
  asyncHandler(async (req: Request, res: Response) => {
    const { branchId, userId } = auth(req);
    res.json({ count: await service.unreadCount(branchId, userId) });
  }),
);

notificationRouter.post(
  "/:id/read",
  asyncHandler(async (req: Request, res: Response) => {
    const { branchId, userId } = auth(req);
    res.json({ notification: await service.markRead(branchId, userId, req.params.id as string) });
  }),
);

notificationRouter.post(
  "/read-all",
  asyncHandler(async (req: Request, res: Response) => {
    const { branchId, userId } = auth(req);
    res.json({ updated: await service.markAllRead(branchId, userId) });
  }),
);
