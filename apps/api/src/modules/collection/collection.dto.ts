import { paginationSchema } from "@bloodline/types";
import { z } from "zod";

export const collectionCreateSchema = z
  .object({
    donorId: z.string().uuid(),
    volumeMl: z.coerce.number().int().min(100).max(550).default(450),
    donationType: z.enum(["VOLUNTARY", "REPLACEMENT"]).default("VOLUNTARY"),
    source: z.enum(["WALK_IN", "CAMP", "HOSPITAL"]).default("WALK_IN"),
    campId: z.string().uuid().optional(),
    collectedAt: z.coerce.date().optional(),
    override: z.boolean().default(false),
    overrideReason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.source !== "CAMP" || !!v.campId, {
    message: "campId is required when source is CAMP",
    path: ["campId"],
  })
  .refine((v) => !v.override || !!v.overrideReason, {
    message: "overrideReason is required when overriding eligibility",
    path: ["overrideReason"],
  });

export const collectionListSchema = paginationSchema.extend({
  status: z.enum(["COLLECTED", "PROCESSING", "REJECTED", "COMPLETED"]).optional(),
  donorId: z.string().uuid().optional(),
  campId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const collectionStatusSchema = z.object({
  status: z.enum(["COLLECTED", "PROCESSING", "REJECTED", "COMPLETED"]),
});

export type CollectionCreateInput = z.infer<typeof collectionCreateSchema>;
export type CollectionListQuery = z.infer<typeof collectionListSchema>;
