import type { Request, Response } from "express";
import { Unauthorized } from "../../lib/errors.js";
import * as donorService from "./donor.service.js";
import { deferralSchema, donorCreateSchema, donorListSchema, donorUpdateSchema } from "./donor.dto.js";

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return {
    branchId: req.user.branchId,
    ctx: { userId: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
  };
}

export async function list(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  const query = donorListSchema.parse(req.query);
  res.json(await donorService.listDonors(branchId, query));
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ donor: await donorService.getDonor(branchId, req.params.id as string) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const input = donorCreateSchema.parse(req.body);
  res.status(201).json({ donor: await donorService.createDonor(branchId, ctx, input) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const input = donorUpdateSchema.parse(req.body);
  res.json({ donor: await donorService.updateDonor(branchId, ctx, req.params.id as string, input) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  await donorService.deleteDonor(branchId, ctx, req.params.id as string);
  res.status(204).send();
}

export async function donations(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json({ data: await donorService.listDonations(branchId, req.params.id as string) });
}

export async function defer(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const input = deferralSchema.parse(req.body);
  res.status(201).json({ deferral: await donorService.addDeferral(branchId, ctx, req.params.id as string, input) });
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  const csv = await donorService.exportDonorsCsv(branchId);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="donors.csv"');
  res.send(csv);
}

export async function importCsv(req: Request, res: Response): Promise<void> {
  const { branchId, ctx } = auth(req);
  const csvText = typeof req.body === "string" ? req.body : (req.body?.csv as string | undefined);
  if (!csvText) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Provide CSV text in the body or a `csv` field" } });
    return;
  }
  res.json({ report: await donorService.importDonorsCsv(branchId, ctx, csvText) });
}

export async function card(req: Request, res: Response): Promise<void> {
  const { branchId } = auth(req);
  res.json(await donorService.generateDonorCard(branchId, req.params.id as string));
}
