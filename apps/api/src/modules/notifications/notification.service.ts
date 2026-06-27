import type { Prisma } from "@bloodline/db";
import { NotFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

/** Inbox = notifications targeted at this user OR broadcast to the whole branch. */
function inboxWhere(branchId: string, userId: string): Prisma.NotificationWhereInput {
  return { branchId, channel: "INAPP", OR: [{ userId }, { userId: null }] };
}

export async function listNotifications(branchId: string, userId: string, unreadOnly: boolean) {
  const where = inboxWhere(branchId, userId);
  if (unreadOnly) where.status = { not: "READ" };
  return prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 });
}

export async function unreadCount(branchId: string, userId: string): Promise<number> {
  return prisma.notification.count({ where: { ...inboxWhere(branchId, userId), status: { not: "READ" } } });
}

export async function markRead(branchId: string, userId: string, id: string) {
  const n = await prisma.notification.findFirst({ where: { id, ...inboxWhere(branchId, userId) } });
  if (!n) throw NotFound("Notification not found");
  return prisma.notification.update({ where: { id }, data: { status: "READ", readAt: new Date() } });
}

export async function markAllRead(branchId: string, userId: string): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { ...inboxWhere(branchId, userId), status: { not: "READ" } },
    data: { status: "READ", readAt: new Date() },
  });
  return res.count;
}
