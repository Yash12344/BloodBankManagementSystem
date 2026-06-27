"use client";

import type { Paginated } from "@bloodline/types";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export interface Eligibility {
  eligible: boolean;
  reasons: string[];
  nextEligibleAt: string | null;
}

export interface Donor {
  id: string;
  donorCode: string;
  name: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  bloodGroup: string;
  weightKg: number;
  mobile: string;
  email?: string | null;
  dob: string;
  status: "ACTIVE" | "DEFERRED" | "BLACKLISTED" | "INACTIVE";
  donationCount: number;
  lastDonationAt: string | null;
  nextEligibleAt: string | null;
  eligibility: Eligibility;
}

export interface DonorListParams {
  q?: string;
  bloodGroup?: string;
  eligible?: "true" | "false";
  page?: number;
}

/** Lightweight data hook for the donor list with manual refetch. */
export function useDonors(params: DonorListParams) {
  const [data, setData] = useState<Donor[]>();
  const [meta, setMeta] = useState<Paginated<Donor>["meta"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();

  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.bloodGroup) query.set("bloodGroup", params.bloodGroup);
  if (params.eligible) query.set("eligible", params.eligible);
  query.set("page", String(params.page ?? 1));
  const qs = query.toString();

  const load = useCallback(() => {
    setLoading(true);
    setError(undefined);
    api<Paginated<Donor>>(`/donors?${qs}`)
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

export async function createDonor(input: Record<string, unknown>): Promise<{ donor: Donor }> {
  return api("/donors", { method: "POST", body: JSON.stringify(input) });
}

export async function recordDonation(donorId: string): Promise<unknown> {
  return api("/collections", { method: "POST", body: JSON.stringify({ donorId }) });
}
