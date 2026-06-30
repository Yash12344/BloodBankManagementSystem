import type { Paginated } from "@bloodline/types";
import type { Prisma } from "@bloodline/db";
import { writeAudit, type AuditInput } from "../../lib/audit.js";
import { NotFound } from "../../lib/errors.js";
import { buildMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import type { CampCreateInput, CampListQuery, CampUpdateInput, ExpenseInput, VolunteerInput } from "./camp.dto.js";
import { summarizeCampFinance } from "./camp.util.js";

type Ctx = Pick<AuditInput, "ip" | "userAgent"> & { userId: string };

export async function listCamps(branchId: string, q: CampListQuery): Promise<Paginated<unknown>> {
  const where: Prisma.CampWhereInput = { branchId };
  if (q.status) where.status = q.status;
  if (q.q) where.name = { contains: q.q, mode: "insensitive" };
  const { skip, take } = toSkipTake(q.page, q.limit);
  const [data, total] = await Promise.all([
    prisma.camp.findMany({
      where,
      skip,
      take,
      orderBy: { scheduledDate: "desc" },
      include: { _count: { select: { donations: true, volunteers: true } } },
    }),
    prisma.camp.count({ where }),
  ]);
  return { data, meta: buildMeta(q.page, q.limit, total) };
}

export async function getCamp(branchId: string, id: string) {
  const camp = await prisma.camp.findFirst({
    where: { id, branchId },
    include: { volunteers: true, expenses: true, photos: true },
  });
  if (!camp) throw NotFound("Camp not found");
  return camp;
}

export async function createCamp(branchId: string, ctx: Ctx, input: CampCreateInput) {
  const camp = await prisma.camp.create({ data: { ...input, branchId } });
  await writeAudit({ branchId, userId: ctx.userId, entity: "camp", entityId: camp.id, action: "CREATE", after: camp });
  return camp;
}

export async function updateCamp(branchId: string, ctx: Ctx, id: string, input: CampUpdateInput) {
  const before = await prisma.camp.findFirst({ where: { id, branchId } });
  if (!before) throw NotFound("Camp not found");
  const camp = await prisma.camp.update({ where: { id }, data: input });
  await writeAudit({ branchId, userId: ctx.userId, entity: "camp", entityId: id, action: "UPDATE", before, after: camp });
  return camp;
}

export async function addVolunteer(branchId: string, _ctx: Ctx, id: string, input: VolunteerInput) {
  await getCamp(branchId, id);
  return prisma.campVolunteer.create({ data: { ...input, campId: id } });
}

export async function addExpense(branchId: string, ctx: Ctx, id: string, input: ExpenseInput) {
  await getCamp(branchId, id);
  const expense = await prisma.campExpense.create({ data: { ...input, campId: id } });
  await writeAudit({ branchId, userId: ctx.userId, entity: "camp", entityId: id, action: "EXPENSE", after: expense });
  return expense;
}

/** Aggregated camp statistics: collection counts, volume, unique donors, and finance. */
export async function campStats(branchId: string, id: string) {
  const camp = await getCamp(branchId, id);
  const [donationAgg, donorGroups, expenses] = await Promise.all([
    prisma.donation.aggregate({ where: { branchId, campId: id }, _count: true, _sum: { volumeMl: true } }),
    prisma.donation.findMany({ where: { branchId, campId: id }, select: { donorId: true }, distinct: ["donorId"] }),
    prisma.campExpense.findMany({ where: { campId: id }, select: { amountMinor: true } }),
  ]);
  const finance = summarizeCampFinance(expenses.map((e) => e.amountMinor), camp.revenueMinor);
  return {
    collections: donationAgg._count,
    volumeMl: donationAgg._sum.volumeMl ?? 0,
    uniqueDonors: donorGroups.length,
    finance,
  };
}

/** Sends a reminder (in-app) to donors who have previously donated at this camp. */
export async function remindCamp(branchId: string, ctx: Ctx, id: string) {
  const camp = await getCamp(branchId, id);
  const donors = await prisma.donation.findMany({ where: { branchId, campId: id }, select: { donorId: true }, distinct: ["donorId"] });
  if (donors.length > 0) {
    await prisma.notification.createMany({
      data: donors.map((d) => ({
        branchId,
        channel: "INAPP" as const,
        type: "camp_reminder",
        status: "SENT" as const,
        sentAt: new Date(),
        payload: { title: "Camp reminder", message: `Upcoming camp: ${camp.name} at ${camp.location}`, campId: id, donorId: d.donorId },
      })),
    });
  }
  await writeAudit({ branchId, userId: ctx.userId, entity: "camp", entityId: id, action: "REMIND", after: { recipients: donors.length } });
  return { recipients: donors.length };
}
