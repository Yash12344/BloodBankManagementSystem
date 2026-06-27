import type { Request, Response } from "express";
import { Unauthorized } from "../../lib/errors.js";
import * as patientService from "./patient.service.js";
import { patientCreateSchema, patientListSchema, patientUpdateSchema } from "./patient.dto.js";

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return {
    branchId: req.user.branchId,
    ctx: { userId: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
  };
}

export async function list(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await patientService.listPatients(branchId, patientListSchema.parse(req.query)));
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ patient: await patientService.getPatient(branchId, req.params.id as string) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.status(201).json({ patient: await patientService.createPatient(branchId, ctx, patientCreateSchema.parse(req.body)) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.json({ patient: await patientService.updatePatient(branchId, ctx, req.params.id as string, patientUpdateSchema.parse(req.body)) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  await patientService.deletePatient(branchId, ctx, req.params.id as string);
  res.status(204).send();
}
