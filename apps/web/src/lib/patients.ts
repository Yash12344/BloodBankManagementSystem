"use client";

import type { Paginated } from "@bloodline/types";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export interface Patient {
  id: string;
  name: string;
  age: number | null;
  bloodGroup: string | null;
  diagnosis: string | null;
  hospital?: { name: string } | null;
}

export function usePatients(params: { q?: string; page?: number } = {}) {
  const [data, setData] = useState<Patient[]>();
  const [meta, setMeta] = useState<Paginated<Patient>["meta"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();

  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  query.set("page", String(params.page ?? 1));
  const qs = query.toString();

  const load = useCallback(() => {
    setLoading(true);
    setError(undefined);
    api<Paginated<Patient>>(`/patients?${qs}`)
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

export const createPatient = (body: Record<string, unknown>) =>
  api("/patients", { method: "POST", body: JSON.stringify(body) });

export const updatePatient = (id: string, body: Record<string, unknown>) =>
  api(`/patients/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deletePatient = (id: string): Promise<void> =>
  api(`/patients/${id}`, { method: "DELETE" });
