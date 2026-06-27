import { paginationSchema } from "@bloodline/types";
import { z } from "zod";

const marker = z.enum(["PENDING", "REACTIVE", "NON_REACTIVE"]);

export const labTestsSchema = z.object({
  hb: z.coerce.number().min(0).max(30).optional(),
  hiv: marker.optional(),
  hbsag: marker.optional(),
  hcv: marker.optional(),
  malaria: marker.optional(),
  syphilis: marker.optional(),
  forwardGroup: z.string().trim().max(10).optional(),
  reverseGroup: z.string().trim().max(10).optional(),
  rh: z.string().trim().max(10).optional(),
  antibodyScreen: z.string().trim().max(40).optional(),
  comments: z.string().trim().max(1000).optional(),
});

export const labRejectSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const labWorklistSchema = paginationSchema.extend({
  result: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export type LabTestsInput = z.infer<typeof labTestsSchema>;
export type LabWorklistQuery = z.infer<typeof labWorklistSchema>;
