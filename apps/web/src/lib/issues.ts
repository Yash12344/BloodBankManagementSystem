"use client";

import type { Paginated } from "@bloodline/types";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export type IssueStatus = "ISSUED" | "RETURNED" | "CANCELLED";

export interface IssueRow {
  id: string;
  issuedAt: string;
  status: IssueStatus;
  patient: { name: string } | null;
  hospital: { name: string } | null;
  invoice: { number: string; totalMinor: number; status: string } | null;
  _count: { items: number };
}

export interface IssueDetail {
  id: string;
  issuedAt: string;
  status: IssueStatus;
  requestId: string;
  slipUrl: string | null;
  patient: { name: string } | null;
  hospital: { name: string } | null;
  items: { id: string; priceMinor: number; component: { barcode: string; type: string; bloodGroup: string } }[];
  invoice: {
    number: string;
    status: string;
    subtotalMinor: number;
    gstMinor: number;
    totalMinor: number;
  } | null;
}

export interface IssueListParams {
  status?: IssueStatus | "";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}

/** Paginated issue history with manual refetch. */
export function useIssues(params: IssueListParams) {
  const [data, setData] = useState<IssueRow[]>();
  const [meta, setMeta] = useState<Paginated<IssueRow>["meta"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();

  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  query.set("page", String(params.page ?? 1));
  const qs = query.toString();

  const load = useCallback(() => {
    setLoading(true);
    setError(undefined);
    api<Paginated<IssueRow>>(`/issues?${qs}`)
      .then((r) => {
        setData(r.data);
        setMeta(r.meta);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [qs]);

  useEffect(() => load(), [load]);
  return { data, meta, loading, error, refetch: load };
}

export const getIssue = (id: string) => api<{ issue: IssueDetail }>(`/issues/${id}`);

export const returnIssue = (id: string, restock: boolean, reason?: string) =>
  api<{ restocked: number; discarded: number; restockEligible: boolean }>(`/issues/${id}/return`, {
    method: "POST",
    body: JSON.stringify({ restock, reason }),
  });
