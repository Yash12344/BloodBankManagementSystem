import type { Paginated } from "@bloodline/types";
import { buildMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";

export async function getOrganization(branchId: string) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, include: { organization: true } });
  return branch;
}

export async function listUsers(branchId: string) {
  return prisma.user.findMany({
    where: { branchId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, status: true, mfaEnabled: true, lastLoginAt: true, role: { select: { name: true } } },
  });
}

/** Role × permission matrix for the settings UI. */
export async function permissionMatrix() {
  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    include: { permissions: { include: { permission: { select: { module: true, action: true } } } } },
  });
  return roles.map((r) => ({
    role: r.name,
    permissions: r.permissions.map((rp) => `${rp.permission.module}.${rp.permission.action}`).sort(),
  }));
}

export async function listAuditLogs(branchId: string, page: number, limit: number): Promise<Paginated<unknown>> {
  const where = { branchId };
  const { skip, take } = toSkipTake(page, limit);
  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { data, meta: buildMeta(page, limit, total) };
}
