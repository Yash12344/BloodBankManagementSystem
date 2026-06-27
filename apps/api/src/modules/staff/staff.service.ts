import { writeAudit, type AuditInput } from "../../lib/audit.js";
import { NotFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AttendanceInput, LeaveInput, ProfileInput } from "./staff.dto.js";

type Ctx = Pick<AuditInput, "ip" | "userAgent"> & { userId: string };

export async function listStaff(branchId: string) {
  return prisma.user.findMany({
    where: { branchId, deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      role: { select: { name: true } },
      staffProfile: { select: { department: true, designation: true, joinDate: true } },
    },
  });
}

async function ensureUser(branchId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, branchId, deletedAt: null }, select: { id: true } });
  if (!user) throw NotFound("Staff member not found");
}

/** Returns the user's staff profile id, creating an empty profile on first use. */
async function profileId(userId: string): Promise<string> {
  const existing = await prisma.staffProfile.findUnique({ where: { userId }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.staffProfile.create({ data: { userId }, select: { id: true } });
  return created.id;
}

export async function getStaff(branchId: string, userId: string) {
  await ensureUser(branchId, userId);
  const profile = await prisma.staffProfile.findUnique({
    where: { userId },
    include: {
      attendance: { orderBy: { date: "desc" }, take: 30 },
      leaves: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: { select: { name: true } } } });
  return { user, profile };
}

export async function upsertProfile(branchId: string, ctx: Ctx, userId: string, input: ProfileInput) {
  await ensureUser(branchId, userId);
  const profile = await prisma.staffProfile.upsert({
    where: { userId },
    create: { userId, ...input },
    update: input,
  });
  await writeAudit({ branchId, userId: ctx.userId, entity: "staff", entityId: userId, action: "PROFILE", after: profile });
  return profile;
}

export async function markAttendance(branchId: string, ctx: Ctx, userId: string, input: AttendanceInput) {
  await ensureUser(branchId, userId);
  const staffId = await profileId(userId);
  // Normalize the date to midnight so the (staffId, date) unique key is per-day.
  const date = new Date(Date.UTC(input.date.getUTCFullYear(), input.date.getUTCMonth(), input.date.getUTCDate()));
  const record = await prisma.attendance.upsert({
    where: { staffId_date: { staffId, date } },
    create: { staffId, date, status: input.status, checkIn: input.checkIn ?? null, checkOut: input.checkOut ?? null },
    update: { status: input.status, checkIn: input.checkIn ?? null, checkOut: input.checkOut ?? null },
  });
  await writeAudit({ branchId, userId: ctx.userId, entity: "staff", entityId: userId, action: "ATTENDANCE", after: record });
  return record;
}

export async function requestLeave(branchId: string, _ctx: Ctx, userId: string, input: LeaveInput) {
  await ensureUser(branchId, userId);
  const staffId = await profileId(userId);
  return prisma.leaveRequest.create({ data: { staffId, ...input, status: "PENDING" } });
}

export async function setLeaveStatus(branchId: string, ctx: Ctx, leaveId: string, status: "PENDING" | "APPROVED" | "REJECTED") {
  const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId }, include: { staff: { select: { user: { select: { branchId: true } } } } } });
  if (!leave || leave.staff.user.branchId !== branchId) throw NotFound("Leave request not found");
  const updated = await prisma.leaveRequest.update({ where: { id: leaveId }, data: { status } });
  await writeAudit({ branchId, userId: ctx.userId, entity: "leave", entityId: leaveId, action: "LEAVE_STATUS", after: { status } });
  return updated;
}

export async function staffActivity(branchId: string, userId: string) {
  await ensureUser(branchId, userId);
  return prisma.auditLog.findMany({ where: { branchId, userId }, orderBy: { createdAt: "desc" }, take: 50 });
}
