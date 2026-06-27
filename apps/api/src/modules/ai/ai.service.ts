import { BLOOD_GROUP_LABEL } from "@bloodline/types";
import type { BloodGroup, ComponentType } from "@bloodline/db";
import { aiEnabled, extractJson, generateText } from "../../lib/ai.js";
import { prisma } from "../../lib/prisma.js";
import { buildReport, REPORT_TYPES, type ReportType } from "../reports/report.service.js";
import { rankDonors, type DonorCandidate } from "./donorRank.js";
import { daysToStockout, forecastDemand, stockRisk } from "./forecast.js";

const DAY_MS = 86_400_000;

/**
 * Low-stock prediction: for each stock cell, estimate daily consumption from the last 30
 * days of ISSUE movements, then project days-to-stockout and a risk band.
 */
export async function lowStockForecast(branchId: string) {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const [stock, issues] = await Promise.all([
    prisma.inventoryStock.findMany({ where: { branchId } }),
    prisma.inventoryMovement.findMany({
      where: { type: "ISSUE", createdAt: { gte: since }, component: { branchId } },
      select: { qty: true, component: { select: { bloodGroup: true, type: true } } },
    }),
  ]);

  const consumption = new Map<string, number>();
  for (const m of issues) {
    const key = `${m.component.bloodGroup}:${m.component.type}`;
    consumption.set(key, (consumption.get(key) ?? 0) + m.qty);
  }

  return stock
    .map((s) => {
      const used = consumption.get(`${s.bloodGroup}:${s.componentType}`) ?? 0;
      const perDay = used / 30;
      const days = daysToStockout(s.available, perDay);
      return {
        bloodGroup: BLOOD_GROUP_LABEL[s.bloodGroup],
        componentType: s.componentType,
        available: s.available,
        dailyConsumption: Number(perDay.toFixed(2)),
        daysToStockout: days === null ? null : Math.round(days),
        risk: stockRisk(days),
      };
    })
    .filter((c) => c.risk !== "ok" || c.dailyConsumption > 0)
    .sort((a, b) => (a.daysToStockout ?? 1e9) - (b.daysToStockout ?? 1e9));
}

/** Demand forecast for a specific group×component over a horizon, from issue history. */
export async function demandForecast(branchId: string, bloodGroup: BloodGroup, componentType: ComponentType, horizonDays: number) {
  const windowDays = 30;
  const since = new Date(Date.now() - windowDays * DAY_MS);
  const issues = await prisma.inventoryMovement.findMany({
    where: { type: "ISSUE", createdAt: { gte: since }, component: { branchId, bloodGroup, type: componentType } },
    select: { qty: true, createdAt: true },
  });

  const buckets = new Array(windowDays).fill(0) as number[];
  for (const m of issues) {
    const idx = Math.floor((m.createdAt.getTime() - since.getTime()) / DAY_MS);
    if (idx >= 0 && idx < windowDays) buckets[idx]! += m.qty;
  }

  return {
    bloodGroup: BLOOD_GROUP_LABEL[bloodGroup],
    componentType,
    horizonDays,
    forecastUnits: forecastDemand(buckets, horizonDays),
    basisDays: windowDays,
  };
}

/** Smart donor suggestions for a needed blood group, ranked deterministically. */
export async function suggestDonors(branchId: string, bloodGroup: BloodGroup, limit = 10) {
  const now = new Date();
  const candidates = await prisma.donor.findMany({
    where: {
      branchId,
      deletedAt: null,
      status: "ACTIVE",
      bloodGroup: { in: [bloodGroup, "O_NEG"] },
      OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }],
    },
    select: { id: true, name: true, bloodGroup: true, donationCount: true, lastDonationAt: true, nextEligibleAt: true },
    take: 100,
  });
  return rankDonors(candidates as DonorCandidate[], bloodGroup, now).slice(0, limit);
}

/**
 * Natural-language search → structured query intent. Uses the LLM when enabled; otherwise a
 * keyword heuristic. Returns the parsed intent (module + filters) for the UI to execute.
 */
export async function nlSearch(query: string): Promise<{ module: string; filters: Record<string, unknown>; source: "ai" | "heuristic" }> {
  if (aiEnabled()) {
    const system =
      "You translate a blood-bank staff member's natural-language search into a JSON query. " +
      'Respond with ONLY a JSON object: {"module": one of [donors,inventory,requests,patients,hospitals,camps,billing], "filters": {...}}. ' +
      "Filters may include bloodGroup (A_POS,A_NEG,B_POS,B_NEG,AB_POS,AB_NEG,O_POS,O_NEG), componentType (WHOLE_BLOOD,PRBC,PLATELETS,FFP,CRYO), status, q (free text). Omit unknown filters.";
    try {
      const text = await generateText({ system, prompt: query, maxTokens: 300 });
      const parsed = extractJson<{ module: string; filters: Record<string, unknown> }>(text);
      if (parsed?.module) return { module: parsed.module, filters: parsed.filters ?? {}, source: "ai" };
    } catch {
      /* fall through to heuristic */
    }
  }
  return { ...heuristicSearch(query), source: "heuristic" };
}

function heuristicSearch(query: string): { module: string; filters: Record<string, unknown> } {
  const q = query.toLowerCase();
  const filters: Record<string, unknown> = {};
  const groupMatch = q.match(/\b(a|b|ab|o)\s*(\+|positive|pos|-|negative|neg)\b/);
  if (groupMatch) {
    const letter = groupMatch[1]!.toUpperCase();
    const sign = /\+|pos/.test(groupMatch[2]!) ? "POS" : "NEG";
    filters.bloodGroup = `${letter}_${sign}`;
  }
  let module = "donors";
  if (/stock|inventory|units|expir/.test(q)) module = "inventory";
  else if (/request|requirement|need/.test(q)) module = "requests";
  else if (/hospital/.test(q)) module = "hospitals";
  else if (/patient/.test(q)) module = "patients";
  else if (/camp/.test(q)) module = "camps";
  else if (/invoice|bill|payment/.test(q)) module = "billing";
  if (module === "donors" && !filters.bloodGroup) filters.q = query;
  return { module, filters };
}

/**
 * Auto report summary. Builds the report, then asks the LLM for a concise narrative when
 * enabled; otherwise returns a deterministic templated summary.
 */
export async function reportSummary(branchId: string, type: string, range: { from?: Date; to?: Date }) {
  if (!(REPORT_TYPES as readonly string[]).includes(type)) throw new Error(`Unknown report type: ${type}`);
  const report = await buildReport(branchId, type as ReportType, range);

  if (aiEnabled() && report.rows.length > 0) {
    const system =
      "You are an analyst for a blood bank. Summarize the report data in 3-4 concise sentences for management. " +
      "Highlight totals, notable patterns, and any risks. Do not invent numbers not present in the data.";
    const sample = report.rows.slice(0, 60);
    const prompt = `Report type: ${type}\nColumns: ${report.headers.join(", ")}\nRows (${report.rows.length} total, showing ${sample.length}):\n${JSON.stringify(sample)}`;
    try {
      const summary = await generateText({ system, prompt, maxTokens: 400 });
      if (summary) return { type, rowCount: report.rows.length, summary, source: "ai" as const };
    } catch {
      /* fall through */
    }
  }

  return {
    type,
    rowCount: report.rows.length,
    summary: `Report '${type}' contains ${report.rows.length} record(s) across columns: ${report.headers.join(", ")}.`,
    source: "template" as const,
  };
}
