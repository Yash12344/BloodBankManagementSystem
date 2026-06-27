import { bloodGroupSchema, genderSchema, paginationSchema } from "@bloodline/types";
import { z } from "zod";

export const patientCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  hospitalId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  age: z.coerce.number().int().min(0).max(150).optional(),
  gender: genderSchema.optional(),
  bloodGroup: bloodGroupSchema.optional(),
  diagnosis: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const patientUpdateSchema = patientCreateSchema.partial();

export const patientListSchema = paginationSchema.extend({
  hospitalId: z.string().uuid().optional(),
  bloodGroup: bloodGroupSchema.optional(),
});

export type PatientCreateInput = z.infer<typeof patientCreateSchema>;
export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>;
export type PatientListQuery = z.infer<typeof patientListSchema>;
