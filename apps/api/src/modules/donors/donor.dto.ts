import { bloodGroupSchema, genderSchema, paginationSchema } from "@bloodline/types";
import { z } from "zod";

export const donorCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  dob: z.coerce.date(),
  gender: genderSchema,
  bloodGroup: bloodGroupSchema,
  weightKg: z.coerce.number().positive().max(400),
  mobile: z.string().trim().min(7).max(20),
  email: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  address: z.string().trim().max(500).optional(),
  occupation: z.string().trim().max(120).optional(),
  medicalHistory: z.string().trim().max(2000).optional(),
  govtIdType: z.string().trim().max(40).optional(),
  govtIdNo: z.string().trim().max(60).optional(),
  emergencyContact: z.string().trim().max(120).optional(),
  photoUrl: z.string().url().optional(),
});

export const donorUpdateSchema = donorCreateSchema.partial();

export const donorListSchema = paginationSchema.extend({
  bloodGroup: bloodGroupSchema.optional(),
  status: z.enum(["ACTIVE", "DEFERRED", "BLACKLISTED", "INACTIVE"]).optional(),
  eligible: z.enum(["true", "false"]).optional(),
});

export const deferralSchema = z.object({
  type: z.enum(["TEMPORARY", "PERMANENT"]),
  reason: z.string().trim().min(3).max(500),
  until: z.coerce.date().optional(),
});

export type DonorCreateInput = z.infer<typeof donorCreateSchema>;
export type DonorUpdateInput = z.infer<typeof donorUpdateSchema>;
export type DonorListQuery = z.infer<typeof donorListSchema>;
export type DeferralInput = z.infer<typeof deferralSchema>;
