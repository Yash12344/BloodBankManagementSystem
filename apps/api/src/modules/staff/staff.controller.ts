import type { Request, Response } from "express";
import { Unauthorized } from "../../lib/errors.js";
import * as staffService from "./staff.service.js";
import { attendanceSchema, leaveSchema, leaveStatusSchema, profileSchema } from "./staff.dto.js";

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return {
    branchId: req.user.branchId,
    ctx: { userId: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
  };
}

export async function list(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ data: await staffService.listStaff(branchId) });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await staffService.getStaff(branchId, req.params.id as string));
}

export async function upsertProfile(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.json({ profile: await staffService.upsertProfile(branchId, ctx, req.params.id as string, profileSchema.parse(req.body)) });
}

export async function markAttendance(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.status(201).json({ attendance: await staffService.markAttendance(branchId, ctx, req.params.id as string, attendanceSchema.parse(req.body)) });
}

export async function requestLeave(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.status(201).json({ leave: await staffService.requestLeave(branchId, ctx, req.params.id as string, leaveSchema.parse(req.body)) });
}

export async function setLeaveStatus(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const { status } = leaveStatusSchema.parse(req.body);
  res.json({ leave: await staffService.setLeaveStatus(branchId, ctx, req.params.leaveId as string, status) });
}

export async function activity(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ data: await staffService.staffActivity(branchId, req.params.id as string) });
}
