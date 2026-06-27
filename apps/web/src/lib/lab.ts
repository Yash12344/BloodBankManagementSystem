"use client";

import type { Paginated } from "@bloodline/types";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export type Marker = "PENDING" | "REACTIVE" | "NON_REACTIVE";

export interface LabRow {
  id: string;
  unitId: string;
  result: "PENDING" | "APPROVED" | "REJECTED";
  hb: number | null;
  hiv: Marker;
  hbsag: Marker;
  hcv: Marker;
  malaria: Marker;
  syphilis: Marker;
  forwardGroup: string | null;
  rh: string | null;
  unit: {
    id: string;
    bagNumber: string;
    bloodGroup: string;
    status: string;
    donation: { donor: { donorCode: string; name: string } | null } | null;
  };
}

export function useLabWorklist() {
  const [data, setData] = useState<LabRow[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();

  const load = useCallback(() => {
    setLoading(true);
    setError(undefined);
    api<Paginated<LabRow>>("/lab/worklist")
      .then((r) => setData(r.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);
  return { data, loading, error, refetch: load };
}

export const recordTests = (unitId: string, body: Record<string, unknown>) =>
  api(`/lab/${unitId}/tests`, { method: "PUT", body: JSON.stringify(body) });

export const approveUnit = (unitId: string) => api(`/lab/${unitId}/approve`, { method: "POST" });

export const rejectUnit = (unitId: string, reason: string) =>
  api(`/lab/${unitId}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
