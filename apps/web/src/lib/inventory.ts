"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export interface MatrixCell {
  bloodGroup: string;
  componentType: string;
  available: number;
  reserved: number;
  issued: number;
  expired: number;
  discarded: number;
  level: "critical" | "low" | "ok";
}

export interface Matrix {
  groups: string[];
  componentTypes: string[];
  cells: MatrixCell[];
  totalAvailable: number;
}

export function useInventoryMatrix() {
  const [data, setData] = useState<Matrix>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();

  const load = useCallback(() => {
    setLoading(true);
    setError(undefined);
    api<Matrix>("/inventory")
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);
  return { data, loading, error, refetch: load };
}

export interface CellUnit {
  id: string;
  barcode: string;
  status: string;
  expiresAt: string;
  storageLocation: string | null;
  unit: { bagNumber: string };
}

export async function fetchCellUnits(group: string, type: string): Promise<CellUnit[]> {
  const r = await api<{ data: CellUnit[] }>(`/inventory/${group}/${type}/units`);
  return r.data;
}
