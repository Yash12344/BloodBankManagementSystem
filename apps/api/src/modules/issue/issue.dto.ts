import { z } from "zod";

export const crossMatchSchema = z.object({
  requestId: z.string().uuid(),
  componentId: z.string().uuid(),
  patientSampleRef: z.string().trim().max(80).optional(),
  result: z.enum(["COMPATIBLE", "INCOMPATIBLE", "PENDING"]).default("COMPATIBLE"),
});

export const issueCreateSchema = z.object({
  requestId: z.string().uuid(),
  componentBarcodes: z.array(z.string().trim().min(3)).min(1, "Scan at least one component"),
});

export type CrossMatchInput = z.infer<typeof crossMatchSchema>;
export type IssueCreateInput = z.infer<typeof issueCreateSchema>;
