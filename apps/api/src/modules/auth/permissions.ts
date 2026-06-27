import { prisma } from "../../lib/prisma.js";

/** A permission key in `module.action` form, e.g. "donors.create". */
export type PermissionKey = `${string}.${string}`;

export const permKey = (module: string, action: string): PermissionKey =>
  `${module}.${action}` as PermissionKey;

/**
 * Computes a user's effective permission set: the role's granted permissions, then
 * per-user overrides applied (allow=true adds, allow=false removes). Returned as a Set
 * of `module.action` strings for O(1) checks in the RBAC middleware.
 */
export async function getEffectivePermissions(userId: string, roleId: string): Promise<Set<string>> {
  const [rolePerms, overrides] = await Promise.all([
    prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { module: true, action: true } } },
    }),
    prisma.userPermissionOverride.findMany({
      where: { userId },
      select: { allow: true, permission: { select: { module: true, action: true } } },
    }),
  ]);

  const set = new Set<string>();
  for (const rp of rolePerms) set.add(permKey(rp.permission.module, rp.permission.action));
  for (const ov of overrides) {
    const k = permKey(ov.permission.module, ov.permission.action);
    if (ov.allow) set.add(k);
    else set.delete(k);
  }
  return set;
}

/**
 * Decides whether a permission set satisfies a required `module.action`. Supports
 * wildcard grants in the set: `module.*`, `*.action`, and `*.*` (god-mode).
 */
export function hasPermission(set: Set<string>, module: string, action: string): boolean {
  return (
    set.has(permKey(module, action)) ||
    set.has(`${module}.*`) ||
    set.has(`*.${action}`) ||
    set.has("*.*")
  );
}
