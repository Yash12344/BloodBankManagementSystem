import type { Paginated } from "@bloodline/types";
import type { Prisma } from "@bloodline/db";
import { writeAudit, type AuditInput } from "../../lib/audit.js";
import { NotFound } from "../../lib/errors.js";
import { buildMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import type { PatientCreateInput, PatientListQuery, PatientUpdateInput } from "./patient.dto.js";

type Ctx = Pick<AuditInput, "ip" | "userAgent"> & { userId: string };

export async function listPatients(branchId: string, q: PatientListQuery): Promise<Paginated<unknown>> {
  const where: Prisma.PatientWhereInput = { branchId, deletedAt: null };
  if (q.hospitalId) where.hospitalId = q.hospitalId;
  if (q.bloodGroup) where.bloodGroup = q.bloodGroup;
  if (q.q) where.name = { contains: q.q, mode: "insensitive" };

  const { skip, take } = toSkipTake(q.page, q.limit);
  const [data, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { hospital: { select: { name: true } }, doctor: { select: { name: true } } },
    }),
    prisma.patient.count({ where }),
  ]);
  return { data, meta: buildMeta(q.page, q.limit, total) };
}

export async function getPatient(branchId: string, id: string) {
  const patient = await prisma.patient.findFirst({
    where: { id, branchId, deletedAt: null },
    include: {
      hospital: { select: { id: true, name: true } },
      doctor: { select: { id: true, name: true } },
      requests: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!patient) throw NotFound("Patient not found");
  return patient;
}

export async function createPatient(branchId: string, ctx: Ctx, input: PatientCreateInput) {
  const patient = await prisma.patient.create({ data: { ...input, branchId } });
  await writeAudit({ branchId, userId: ctx.userId, entity: "patient", entityId: patient.id, action: "CREATE", after: patient });
  return patient;
}

export async function updatePatient(branchId: string, ctx: Ctx, id: string, input: PatientUpdateInput) {
  const before = await prisma.patient.findFirst({ where: { id, branchId, deletedAt: null } });
  if (!before) throw NotFound("Patient not found");
  const patient = await prisma.patient.update({ where: { id }, data: input });
  await writeAudit({ branchId, userId: ctx.userId, entity: "patient", entityId: id, action: "UPDATE", before, after: patient });
  return patient;
}

export async function deletePatient(branchId: string, ctx: Ctx, id: string): Promise<void> {
  const patient = await prisma.patient.findFirst({ where: { id, branchId, deletedAt: null } });
  if (!patient) throw NotFound("Patient not found");
  await prisma.patient.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({ branchId, userId: ctx.userId, entity: "patient", entityId: id, action: "DELETE", before: patient });
}
