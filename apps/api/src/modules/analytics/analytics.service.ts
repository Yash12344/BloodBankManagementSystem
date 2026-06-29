import { BLOOD_GROUPS, BLOOD_GROUP_LABEL } from "@bloodline/types";
import { prisma } from "../../lib/prisma.js";

const CRITICAL_GROUP_THRESHOLD = 2;

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** KPI snapshot for the dashboard header cards. */
export async function summary(branchId: string) {
  const today = startOfTodayUtc();
  const endOfToday = new Date(today.getTime() + 86_400_000);
  const in7 = new Date(Date.now() + 7 * 86_400_000);

  const [collections, issued, openRequests, emergencies, pendingTests, revenue, stock, expiring, expiringToday, levels] =
    await Promise.all([
      prisma.donation.count({ where: { branchId, collectedAt: { gte: today } } }),
      prisma.issue.count({ where: { branchId, issuedAt: { gte: today } } }),
      prisma.bloodRequest.count({ where: { branchId, status: "PENDING" } }),
      prisma.bloodRequest.count({ where: { branchId, status: "PENDING", priority: "CRITICAL" } }),
      prisma.labTest.count({ where: { unit: { branchId }, result: "PENDING" } }),
      prisma.payment.aggregate({ where: { invoice: { branchId }, receivedAt: { gte: today } }, _sum: { amountMinor: true } }),
      prisma.inventoryStock.aggregate({ where: { branchId }, _sum: { available: true } }),
      prisma.bloodComponent.count({ where: { branchId, status: "AVAILABLE", expiresAt: { lte: in7 } } }),
      prisma.bloodComponent.count({ where: { branchId, status: "AVAILABLE", expiresAt: { lte: endOfToday } } }),
      prisma.inventoryStock.groupBy({ by: ["bloodGroup"], where: { branchId }, _sum: { available: true } }),
    ]);

  // A group is critical if its total available stock is at/below the threshold — including
  // groups with no stock row at all (which never appear in the groupBy result).
  const healthy = levels.filter((l) => (l._sum.available ?? 0) > CRITICAL_GROUP_THRESHOLD).length;

  return {
    todaysCollection: collections,
    todaysIssued: issued,
    openRequests,
    emergencies,
    pendingTests,
    todaysRevenueMinor: revenue._sum.amountMinor ?? 0,
    totalAvailableUnits: stock._sum.available ?? 0,
    expiringSoon: expiring,
    expiringToday,
    criticalGroups: BLOOD_GROUPS.length - healthy,
  };
}

/** Per-blood-group available levels with a critical flag, for the dashboard stock strip. */
export async function bloodGroupLevels(branchId: string) {
  const grouped = await prisma.inventoryStock.groupBy({ by: ["bloodGroup"], where: { branchId }, _sum: { available: true } });
  const map = new Map(grouped.map((g) => [g.bloodGroup, g._sum.available ?? 0] as const));
  return BLOOD_GROUPS.map((g) => {
    const available = map.get(g) ?? 0;
    return { code: g, bloodGroup: BLOOD_GROUP_LABEL[g], available, critical: available <= CRITICAL_GROUP_THRESHOLD };
  });
}

/** Real, unified recent-activity feed (collections + issues), newest first. */
export async function recentActivity(branchId: string, limit = 12) {
  const [collections, issues] = await Promise.all([
    prisma.donation.findMany({
      where: { branchId },
      orderBy: { collectedAt: "desc" },
      take: limit,
      select: { id: true, collectedAt: true, volumeMl: true, donor: { select: { name: true, bloodGroup: true } } },
    }),
    prisma.issue.findMany({
      where: { branchId },
      orderBy: { issuedAt: "desc" },
      take: limit,
      select: { id: true, issuedAt: true, hospital: { select: { name: true } }, patient: { select: { name: true } }, _count: { select: { items: true } } },
    }),
  ]);

  const items = [
    ...collections.map((c) => ({
      id: `col-${c.id}`,
      kind: "collection" as const,
      at: c.collectedAt.toISOString(),
      text: `${c.donor.name} donated ${c.volumeMl} ml (${BLOOD_GROUP_LABEL[c.donor.bloodGroup]})`,
    })),
    ...issues.map((i) => ({
      id: `iss-${i.id}`,
      kind: "issue" as const,
      at: i.issuedAt.toISOString(),
      text: `Issued ${i._count.items} unit(s) to ${i.hospital?.name ?? i.patient?.name ?? "—"}`,
    })),
  ];
  items.sort((a, b) => (a.at < b.at ? 1 : -1));
  return items.slice(0, limit);
}

/** Real units expiring within `days`, soonest first — FEFO candidates for the dashboard. */
export async function expiringUnits(branchId: string, days = 7, limit = 10) {
  const until = new Date(Date.now() + days * 86_400_000);
  const comps = await prisma.bloodComponent.findMany({
    where: { branchId, status: "AVAILABLE", expiresAt: { lte: until } },
    orderBy: { expiresAt: "asc" },
    take: limit,
    select: { id: true, barcode: true, type: true, bloodGroup: true, expiresAt: true, storageLocation: true },
  });
  return comps.map((c) => ({
    id: c.id,
    barcode: c.barcode,
    type: c.type,
    bloodGroup: BLOOD_GROUP_LABEL[c.bloodGroup],
    storageLocation: c.storageLocation,
    expiresAt: c.expiresAt.toISOString(),
  }));
}

/** Daily collection counts for the last `days` days (zero-filled). */
export async function collectionTrends(branchId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const donations = await prisma.donation.findMany({ where: { branchId, collectedAt: { gte: since } }, select: { collectedAt: true } });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    buckets.set(d, 0);
  }
  for (const don of donations) {
    const key = don.collectedAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count })).reverse();
}

export async function demandByGroup(branchId: string) {
  const grouped = await prisma.bloodRequest.groupBy({ by: ["bloodGroup"], where: { branchId }, _sum: { unitsRequested: true } });
  return grouped.map((g) => ({ bloodGroup: BLOOD_GROUP_LABEL[g.bloodGroup], units: g._sum.unitsRequested ?? 0 }));
}

export async function componentDistribution(branchId: string) {
  const grouped = await prisma.inventoryStock.groupBy({ by: ["componentType"], where: { branchId }, _sum: { available: true } });
  return grouped.map((g) => ({ componentType: g.componentType, available: g._sum.available ?? 0 }));
}

export async function topDonors(branchId: string, limit = 10) {
  const donors = await prisma.donor.findMany({
    where: { branchId, deletedAt: null },
    orderBy: { donationCount: "desc" },
    take: limit,
    select: { id: true, donorCode: true, name: true, bloodGroup: true, donationCount: true },
  });
  return donors.map((d) => ({ ...d, bloodGroup: BLOOD_GROUP_LABEL[d.bloodGroup] }));
}

export async function topHospitals(branchId: string, limit = 10) {
  const hospitals = await prisma.hospital.findMany({
    where: { branchId, deletedAt: null },
    orderBy: { issues: { _count: "desc" } },
    take: limit,
    select: { id: true, name: true, outstandingMinor: true, _count: { select: { issues: true, requests: true } } },
  });
  return hospitals.map((h) => ({ id: h.id, name: h.name, issues: h._count.issues, requests: h._count.requests, outstandingMinor: h.outstandingMinor }));
}

/** Daily revenue (paid amounts) for the last `days` days. */
export async function revenueTrend(branchId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const payments = await prisma.payment.findMany({ where: { invoice: { branchId }, receivedAt: { gte: since } }, select: { receivedAt: true, amountMinor: true } });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    buckets.set(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10), 0);
  }
  for (const p of payments) {
    const key = p.receivedAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + p.amountMinor);
  }
  return [...buckets.entries()].map(([date, amountMinor]) => ({ date, amountMinor })).reverse();
}
