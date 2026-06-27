import type { Paginated } from "@bloodline/types";
import type { Prisma } from "@bloodline/db";
import { writeAudit, type AuditInput } from "../../lib/audit.js";
import { NotFound } from "../../lib/errors.js";
import { buildMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import type { DoctorCreateInput, HospitalCreateInput, HospitalListQuery, HospitalUpdateInput } from "./hospital.dto.js";

type Ctx = Pick<AuditInput, "ip" | "userAgent"> & { userId: string };

export async function listHospitals(branchId: string, q: HospitalListQuery): Promise<Paginated<unknown>> {
  const where: Prisma.HospitalWhereInput = { branchId, deletedAt: null };
  if (q.q) where.name = { contains: q.q, mode: "insensitive" };
  const { skip, take } = toSkipTake(q.page, q.limit);
  const [data, total] = await Promise.all([
    prisma.hospital.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: { _count: { select: { doctors: true, requests: true } } },
    }),
    prisma.hospital.count({ where }),
  ]);
  return { data, meta: buildMeta(q.page, q.limit, total) };
}

export async function getHospital(branchId: string, id: string) {
  const hospital = await prisma.hospital.findFirst({
    where: { id, branchId, deletedAt: null },
    include: { doctors: { orderBy: { name: "asc" } } },
  });
  if (!hospital) throw NotFound("Hospital not found");
  return hospital;
}

export async function createHospital(branchId: string, ctx: Ctx, input: HospitalCreateInput) {
  const hospital = await prisma.hospital.create({ data: { ...input, branchId } });
  await writeAudit({ branchId, userId: ctx.userId, entity: "hospital", entityId: hospital.id, action: "CREATE", after: hospital });
  return hospital;
}

export async function updateHospital(branchId: string, ctx: Ctx, id: string, input: HospitalUpdateInput) {
  const before = await prisma.hospital.findFirst({ where: { id, branchId, deletedAt: null } });
  if (!before) throw NotFound("Hospital not found");
  const hospital = await prisma.hospital.update({ where: { id }, data: input });
  await writeAudit({ branchId, userId: ctx.userId, entity: "hospital", entityId: id, action: "UPDATE", before, after: hospital });
  return hospital;
}

export async function deleteHospital(branchId: string, ctx: Ctx, id: string): Promise<void> {
  const hospital = await prisma.hospital.findFirst({ where: { id, branchId, deletedAt: null } });
  if (!hospital) throw NotFound("Hospital not found");
  await prisma.hospital.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({ branchId, userId: ctx.userId, entity: "hospital", entityId: id, action: "DELETE", before: hospital });
}

export async function addDoctor(branchId: string, ctx: Ctx, hospitalId: string, input: DoctorCreateInput) {
  await getHospital(branchId, hospitalId);
  const doctor = await prisma.hospitalDoctor.create({ data: { ...input, hospitalId } });
  await writeAudit({ branchId, userId: ctx.userId, entity: "hospital_doctor", entityId: doctor.id, action: "CREATE", after: doctor });
  return doctor;
}

export async function hospitalHistory(branchId: string, id: string) {
  await getHospital(branchId, id);
  const [requests, issues] = await Promise.all([
    prisma.bloodRequest.findMany({ where: { branchId, hospitalId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.issue.findMany({ where: { branchId, hospitalId: id }, orderBy: { issuedAt: "desc" }, take: 50, include: { invoice: { select: { number: true, totalMinor: true, status: true } } } }),
  ]);
  return { requests, issues };
}

/** Outstanding = sum of unpaid/partial invoice balances for the hospital. */
export async function hospitalOutstanding(branchId: string, id: string) {
  await getHospital(branchId, id);
  const agg = await prisma.invoice.aggregate({
    where: { branchId, hospitalId: id, status: { in: ["UNPAID", "PARTIAL"] } },
    _sum: { balanceMinor: true },
    _count: true,
  });
  return { outstandingMinor: agg._sum.balanceMinor ?? 0, openInvoices: agg._count };
}
