import { z } from "zod";

export const separateSchema = z.object({
  types: z
    .array(z.enum(["WHOLE_BLOOD", "PRBC", "PLATELETS", "FFP", "CRYO"]))
    .min(1, "Select at least one component"),
  storageLocation: z.string().trim().max(60).optional(),
  // Optional per-type volume override (ml); defaults split the unit volume.
  volumeMl: z.coerce.number().int().min(10).max(550).optional(),
});

export const discardSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type SeparateInput = z.infer<typeof separateSchema>;
