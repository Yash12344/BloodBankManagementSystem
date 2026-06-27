import { BLOOD_GROUP_LABEL } from "@bloodline/types";
import type { Prisma } from "@bloodline/db";
import { prisma } from "../../lib/prisma.js";

export const REPORT_TYPES = ["inventory", "donors", "collection", "issue", "lab", "finance"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportData {
  type: ReportType;
  generatedAt: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

interface Range {
  from?: Date;
  to?: Date;
}

function dateRange(r: Range): Prisma.DateTimeFilter {
  const filter: Prisma.DateTimeFilter = {};
  if (r.from) filter.gte = r.from;
  if (r.to) filter.lte = r.to;
  return filter;
}

const money = (minor: number) => (minor / 100).toFixed(2);

async function inventoryReport(branchId: string): Promise<ReportData> {
  const rows = await prisma.inventoryStock.findMany({ where: { branchId }, orderBy: [{ bloodGroup: "asc" }, { componentType: "asc" }] });
  return {
    type: "inventory",
    generatedAt: new Date().toISOString(),
    headers: ["bloodGroup", "component", "available", "reserved", "issued", "expired", "discarded"],
    rows: rows.map((r) => ({
      bloodGroup: BLOOD_GROUP_LABEL[r.bloodGroup],
      component: r.componentType,
      available: r.available,
      reserved: r.reserved,
      issued: r.issued,
      expired: r.expired,
      discarded: r.discarded,
    })),
  };
}

async function donorsReport(branchId: string): Promise<ReportData> {
  const rows = await prisma.donor.findMany({ where: { branchId, deletedAt: null }, orderBy: { donorCode: "asc" } });
  return {
    type: "donors",
    generatedAt: new Date().toISOString(),
    headers: ["donorCode", "name", "bloodGroup", "mobile", "donationCount", "lastDonationAt", "status"],
    rows: rows.map((d) => ({
      donorCode: d.donorCode,
      name: d.name,
      bloodGroup: BLOOD_GROUP_LABEL[d.bloodGroup],
      mobile: d.mobile,
      donationCount: d.donationCount,
      lastDonationAt: d.lastDonationAt?.toISOString().slice(0, 10) ?? "",
      status: d.status,
    })),
  };
}

async function collectionReport(branchId: string, range: Range): Promise<ReportData> {
  const rows = await prisma.donation.findMany({
    where: { branchId, collectedAt: dateRange(range) },
    orderBy: { collectedAt: "desc" },
    include: { donor: { select: { donorCode: true, name: true, bloodGroup: true } }, unit: { select: { bagNumber: true } } },
  });
  return {
    type: "collection",
    generatedAt: new Date().toISOString(),
    headers: ["date", "bag", "donor", "bloodGroup", "volumeMl", "type", "source", "status"],
    rows: rows.map((c) => ({
      date: c.collectedAt.toISOString().slice(0, 10),
      bag: c.unit?.bagNumber ?? "",
      donor: c.donor.name,
      bloodGroup: BLOOD_GROUP_LABEL[c.donor.bloodGroup],
      volumeMl: c.volumeMl,
      type: c.donationType,
      source: c.source,
      status: c.status,
    })),
  };
}

async function issueReport(branchId: string, range: Range): Promise<ReportData> {
  const rows = await prisma.issue.findMany({
    where: { branchId, issuedAt: dateRange(range) },
    orderBy: { issuedAt: "desc" },
    include: { patient: { select: { name: true } }, hospital: { select: { name: true } }, _count: { select: { items: true } }, invoice: { select: { number: true, totalMinor: true } } },
  });
  return {
    type: "issue",
    generatedAt: new Date().toISOString(),
    headers: ["date", "patient", "hospital", "units", "invoice", "amount", "status"],
    rows: rows.map((i) => ({
      date: i.issuedAt.toISOString().slice(0, 10),
      patient: i.patient?.name ?? "",
      hospital: i.hospital?.name ?? "",
      units: i._count.items,
      invoice: i.invoice?.number ?? "",
      amount: i.invoice ? money(i.invoice.totalMinor) : "",
      status: i.status,
    })),
  };
}

async function labReport(branchId: string, range: Range): Promise<ReportData> {
  const rows = await prisma.labTest.findMany({
    where: { unit: { branchId }, createdAt: dateRange(range) },
    orderBy: { createdAt: "desc" },
    include: { unit: { select: { bagNumber: true, bloodGroup: true } } },
  });
  return {
    type: "lab",
    generatedAt: new Date().toISOString(),
    headers: ["bag", "bloodGroup", "hiv", "hbsag", "hcv", "malaria", "syphilis", "result"],
    rows: rows.map((l) => ({
      bag: l.unit.bagNumber,
      bloodGroup: BLOOD_GROUP_LABEL[l.unit.bloodGroup],
      hiv: l.hiv,
      hbsag: l.hbsag,
      hcv: l.hcv,
      malaria: l.malaria,
      syphilis: l.syphilis,
      result: l.result,
    })),
  };
}

async function financeReport(branchId: string, range: Range): Promise<ReportData> {
  const rows = await prisma.invoice.findMany({
    where: { branchId, issuedAt: dateRange(range), status: { not: "VOID" } },
    orderBy: { issuedAt: "desc" },
    include: { hospital: { select: { name: true } } },
  });
  return {
    type: "finance",
    generatedAt: new Date().toISOString(),
    headers: ["date", "invoice", "billedTo", "subtotal", "gst", "total", "balance", "status"],
    rows: rows.map((inv) => ({
      date: inv.issuedAt.toISOString().slice(0, 10),
      invoice: inv.number,
      billedTo: inv.hospital?.name ?? "Walk-in",
      subtotal: money(inv.subtotalMinor),
      gst: money(inv.gstMinor),
      total: money(inv.totalMinor),
      balance: money(inv.balanceMinor),
      status: inv.status,
    })),
  };
}

export async function buildReport(branchId: string, type: ReportType, range: Range): Promise<ReportData> {
  switch (type) {
    case "inventory":
      return inventoryReport(branchId);
    case "donors":
      return donorsReport(branchId);
    case "collection":
      return collectionReport(branchId, range);
    case "issue":
      return issueReport(branchId, range);
    case "lab":
      return labReport(branchId, range);
    case "finance":
      return financeReport(branchId, range);
  }
}
