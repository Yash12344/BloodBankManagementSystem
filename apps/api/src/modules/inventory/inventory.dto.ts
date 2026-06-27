import { bloodGroupSchema, componentTypeSchema, paginationSchema } from "@bloodline/types";
import { z } from "zod";

export const expiringSchema = z.object({
  days: z.coerce.number().int().min(1).max(60).default(7),
});

export const movementsSchema = paginationSchema.extend({
  type: z
    .enum(["IN", "RESERVE", "RELEASE", "ISSUE", "EXPIRE", "DISCARD", "TRANSFER_IN", "TRANSFER_OUT", "RETURN"])
    .optional(),
});

export const cellSchema = z.object({
  bloodGroup: bloodGroupSchema,
  componentType: componentTypeSchema,
});

export const fefoSchema = z.object({
  bloodGroup: bloodGroupSchema,
  componentType: componentTypeSchema,
  qty: z.coerce.number().int().min(1).max(50).default(1),
});

export type MovementsQuery = z.infer<typeof movementsSchema>;
