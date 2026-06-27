/**
 * Shared domain constants, enums and zod schemas used by both API and web.
 * Keeping these in one package guarantees the contract stays in sync end to end.
 */
import { z } from "zod";

// ---- Enumerations (mirror the Prisma enums) ----
export const BLOOD_GROUPS = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"] as const;
export const COMPONENT_TYPES = ["WHOLE_BLOOD", "PRBC", "PLATELETS", "FFP", "CRYO"] as const;
export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

export const bloodGroupSchema = z.enum(BLOOD_GROUPS);
export const componentTypeSchema = z.enum(COMPONENT_TYPES);
export const genderSchema = z.enum(GENDERS);

// Human-readable labels for blood groups (UI display).
export const BLOOD_GROUP_LABEL: Record<(typeof BLOOD_GROUPS)[number], string> = {
  A_POS: "A+",
  A_NEG: "A-",
  B_POS: "B+",
  B_NEG: "B-",
  AB_POS: "AB+",
  AB_NEG: "AB-",
  O_POS: "O+",
  O_NEG: "O-",
};

// Component shelf-life in days from preparation (used to compute expiry).
export const COMPONENT_SHELF_LIFE_DAYS: Record<(typeof COMPONENT_TYPES)[number], number> = {
  WHOLE_BLOOD: 35,
  PRBC: 42,
  PLATELETS: 5,
  FFP: 365,
  CRYO: 365,
};

// ---- Shared request shapes ----
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().optional(),
  q: z.string().trim().optional(),
});
export type Pagination = z.infer<typeof paginationSchema>;

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paginated<T> {
  data: T[];
  meta: PaginatedMeta;
}

// ---- Standard API error envelope ----
export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
