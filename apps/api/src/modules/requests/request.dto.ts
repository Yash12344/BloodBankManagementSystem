import { bloodGroupSchema, componentTypeSchema, paginationSchema } from "@bloodline/types";
import { z } from "zod";

export const requestCreateSchema = z.object({
  patientId: z.string().uuid().optional(),
  hospitalId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  channel: z.enum(["ONLINE", "HOSPITAL", "EMERGENCY"]).default("HOSPITAL"),
  priority: z.enum(["CRITICAL", "NORMAL"]).default("NORMAL"),
  bloodGroup: bloodGroupSchema,
  componentType: componentTypeSchema,
  unitsRequested: z.coerce.number().int().min(1).max(50),
  requiredBy: z.coerce.date().optional(),
});

export const requestListSchema = paginationSchema.extend({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "COMPLETED", "CANCELLED"]).optional(),
  priority: z.enum(["CRITICAL", "NORMAL"]).optional(),
  hospitalId: z.string().uuid().optional(),
});

export const requestRejectSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type RequestCreateInput = z.infer<typeof requestCreateSchema>;
export type RequestListQuery = z.infer<typeof requestListSchema>;
