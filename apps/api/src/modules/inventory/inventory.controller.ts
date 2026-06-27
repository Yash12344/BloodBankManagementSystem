import type { Request, Response } from "express";
import { Unauthorized } from "../../lib/errors.js";
import * as inventoryService from "./inventory.service.js";
import { cellSchema, expiringSchema, fefoSchema, movementsSchema } from "./inventory.dto.js";

function auth(req: Request) {
  if (!req.user) throw Unauthorized();
  return req.user.branchId;
}

export async function matrix(req: Request, res: Response): Promise<void> {
  res.json(await inventoryService.matrix(auth(req)));
}

export async function expiring(req: Request, res: Response): Promise<void> {
  const { days } = expiringSchema.parse(req.query);
  res.json({ data: await inventoryService.expiringSoon(auth(req), days) });
}

export async function movements(req: Request, res: Response): Promise<void> {
  res.json(await inventoryService.movements(auth(req), movementsSchema.parse(req.query)));
}

export async function cellUnits(req: Request, res: Response): Promise<void> {
  const { bloodGroup, componentType } = cellSchema.parse(req.params);
  res.json({ data: await inventoryService.unitsInCell(auth(req), bloodGroup, componentType) });
}

export async function fefo(req: Request, res: Response): Promise<void> {
  const { bloodGroup, componentType, qty } = fefoSchema.parse(req.query);
  res.json({ data: await inventoryService.fefo(auth(req), bloodGroup, componentType, qty) });
}
