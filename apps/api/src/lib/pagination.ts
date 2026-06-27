import type { Paginated, PaginatedMeta } from "@bloodline/types";

/** Converts page/limit into Prisma skip/take. */
export function toSkipTake(page: number, limit: number): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

/**
 * Parses a `field:dir` sort string against an allow-list of sortable columns, returning a
 * Prisma orderBy object. Falls back to the default when absent or not permitted.
 */
export function parseSort<TField extends string>(
  sort: string | undefined,
  allowed: readonly TField[],
  fallback: { [k in TField]?: "asc" | "desc" },
): Record<string, "asc" | "desc"> {
  if (!sort) return fallback as Record<string, "asc" | "desc">;
  const [field, dir] = sort.split(":");
  if (field && (allowed as readonly string[]).includes(field)) {
    return { [field]: dir === "asc" ? "asc" : "desc" };
  }
  return fallback as Record<string, "asc" | "desc">;
}

export function buildMeta(page: number, limit: number, total: number): PaginatedMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function paginate<T>(data: T[], page: number, limit: number, total: number): Paginated<T> {
  return { data, meta: buildMeta(page, limit, total) };
}
