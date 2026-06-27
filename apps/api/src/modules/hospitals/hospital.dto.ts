import { paginationSchema } from "@bloodline/types";
import { z } from "zod";

export const hospitalCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  gstin: z.string().trim().max(20).optional(),
  creditLimitMinor: z.coerce.number().int().min(0).default(0),
});

export const hospitalUpdateSchema = hospitalCreateSchema.partial();

export const hospitalListSchema = paginationSchema;

export const doctorCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).optional(),
  specialization: z.string().trim().max(80).optional(),
  regNo: z.string().trim().max(60).optional(),
});

export type HospitalCreateInput = z.infer<typeof hospitalCreateSchema>;
export type HospitalUpdateInput = z.infer<typeof hospitalUpdateSchema>;
export type HospitalListQuery = z.infer<typeof hospitalListSchema>;
export type DoctorCreateInput = z.infer<typeof doctorCreateSchema>;
