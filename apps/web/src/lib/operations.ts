"use client";

import type { Paginated } from "@bloodline/types";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/** Generic paginated-list hook used by the simpler operational screens. */
export function useList<T>(path: string) {
  const [data, setData] = useState<T[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();

  const load = useCallback(() => {
    setLoading(true);
    setError(undefined);
    api<Paginated<T> | { data: T[] }>(path)
      .then((r) => setData((r as { data: T[] }).data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => load(), [load]);
  return { data, loading, error, refetch: load };
}

export const post = <T = unknown>(path: string, body: Record<string, unknown>) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });

export const get = <T = unknown>(path: string) => api<T>(path);

export interface Hospital {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  _count?: { doctors: number; requests: number };
}

export interface Camp {
  id: string;
  name: string;
  location: string;
  scheduledDate: string;
  status: string;
  _count?: { donations: number; volunteers: number };
}

export interface CampStats {
  collections: number;
  volumeMl: number;
  uniqueDonors: number;
  finance: { expenseMinor: number; revenueMinor: number; netMinor: number };
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  status: string;
  role: { name: string };
  staffProfile: { department: string | null; designation: string | null } | null;
}

export const formatMinor = (minor: number) => `₹${(minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
