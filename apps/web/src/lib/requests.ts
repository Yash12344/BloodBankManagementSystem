"use client";

import type { Paginated } from "@bloodline/types";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export interface BloodRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";
  priority: "CRITICAL" | "NORMAL";
  channel: string;
  bloodGroup: string;
  componentType: string;
  unitsRequested: number;
  patient?: { name: string } | null;
  hospital?: { name: string } | null;
  _count?: { reservations: number };
}

export interface RequestDetail extends BloodRequest {
  reservations: { id: string; component: { id: string; barcode: string; expiresAt: string; status: string } }[];
  crossMatches: { id: string; componentId: string; result: string }[];
}

export function useRequests(status?: string) {
  const [data, setData] = useState<BloodRequest[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();

  const qs = status ? `?status=${status}` : "";
  const load = useCallback(() => {
    setLoading(true);
    setError(undefined);
    api<Paginated<BloodRequest>>(`/requests${qs}`)
      .then((r) => setData(r.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [qs]);

  useEffect(() => load(), [load]);
  return { data, loading, error, refetch: load };
}

export const createRequest = (body: Record<string, unknown>) =>
  api<{ request: BloodRequest }>("/requests", { method: "POST", body: JSON.stringify(body) });

export const getRequest = (id: string) => api<{ request: RequestDetail }>(`/requests/${id}`);

export const approveRequest = (id: string) =>
  api<{ reserved: number; requested: number; shortfall: number }>(`/requests/${id}/approve`, { method: "POST" });

export const rejectRequest = (id: string, reason: string) =>
  api(`/requests/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });

export const cancelRequest = (id: string) => api(`/requests/${id}/cancel`, { method: "POST" });

export const crossMatch = (requestId: string, componentId: string) =>
  api("/crossmatch", { method: "POST", body: JSON.stringify({ requestId, componentId, result: "COMPATIBLE" }) });

export const issueBlood = (requestId: string, componentBarcodes: string[]) =>
  api<{ issue: { id: string }; invoice: { number: string } }>("/issues", {
    method: "POST",
    body: JSON.stringify({ requestId, componentBarcodes }),
  });
