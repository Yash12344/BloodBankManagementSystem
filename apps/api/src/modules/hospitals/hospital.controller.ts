import type { Request, Response } from "express";
import { Unauthorized } from "../../lib/errors.js";
import * as hospitalService from "./hospital.service.js";
import { doctorCreateSchema, hospitalCreateSchema, hospitalListSchema, hospitalUpdateSchema } from "./hospital.dto.js";

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return {
    branchId: req.user.branchId,
    ctx: { userId: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
  };
}

export async function list(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await hospitalService.listHospitals(branchId, hospitalListSchema.parse(req.query)));
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ hospital: await hospitalService.getHospital(branchId, req.params.id as string) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.status(201).json({ hospital: await hospitalService.createHospital(branchId, ctx, hospitalCreateSchema.parse(req.body)) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.json({ hospital: await hospitalService.updateHospital(branchId, ctx, req.params.id as string, hospitalUpdateSchema.parse(req.body)) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  await hospitalService.deleteHospital(branchId, ctx, req.params.id as string);
  res.status(204).send();
}

export async function addDoctor(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  res.status(201).json({ doctor: await hospitalService.addDoctor(branchId, ctx, req.params.id as string, doctorCreateSchema.parse(req.body)) });
}

export async function history(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await hospitalService.hospitalHistory(branchId, req.params.id as string));
}

export async function outstanding(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await hospitalService.hospitalOutstanding(branchId, req.params.id as string));
}
