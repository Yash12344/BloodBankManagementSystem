import { paginationSchema } from "@bloodline/types";
import { z } from "zod";

export const campCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  location: z.string().trim().min(2).max(200),
  scheduledDate: z.coerce.date(),
  organizer: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const campUpdateSchema = campCreateSchema.partial().extend({
  status: z.enum(["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"]).optional(),
  revenueMinor: z.coerce.number().int().min(0).optional(),
});

export const campListSchema = paginationSchema.extend({
  status: z.enum(["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"]).optional(),
});

export const volunteerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  role: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(20).optional(),
});

export const expenseSchema = z.object({
  head: z.string().trim().min(2).max(120),
  amountMinor: z.coerce.number().int().min(0),
});

export type CampCreateInput = z.infer<typeof campCreateSchema>;
export type CampUpdateInput = z.infer<typeof campUpdateSchema>;
export type CampListQuery = z.infer<typeof campListSchema>;
export type VolunteerInput = z.infer<typeof volunteerSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
