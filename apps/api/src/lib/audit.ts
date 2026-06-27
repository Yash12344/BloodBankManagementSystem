import type { Prisma } from "@bloodline/db";
import { prisma } from "./prisma.js";

export interface AuditInput {
  branchId?: string | null;
  userId?: string | null;
  entity: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Writes an append-only audit entry. Pass a transaction client (`tx`) to record the
 * audit in the same transaction as the mutation it describes, guaranteeing they commit
 * or roll back together.
 */
export async function writeAudit(
  input: AuditInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      branchId: input.branchId ?? null,
      userId: input.userId ?? null,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
