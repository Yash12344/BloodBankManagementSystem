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

export function usePatients(q?: string) {
  const [data, setData] = useState<Patient[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();

  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const load = useCallback(() => {
    setLoading(true);
    setError(undefined);
    api<Paginated<Patient>>(`/patients${qs}`)
      .then((r) => setData(r.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [qs]);

  useEffect(() => load(), [load]);
  return { data, loading, error, refetch: load };
}

export const createPatient = (body: Record<string, unknown>) =>
  api("/patients", { method: "POST", body: JSON.stringify(body) });
