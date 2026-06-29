"use client";

import type { Paginated } from "@bloodline/types";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export type CollectionStatus = "COLLECTED" | "PROCESSING" | "REJECTED" | "COMPLETED";

export interface CollectionRow {
  id: string;
  collectedAt: string;
  volumeMl: number;
  donationType: "VOLUNTARY" | "REPLACEMENT";
  source: "WALK_IN" | "CAMP" | "HOSPITAL";
  status: CollectionStatus;
  donor: { donorCode: string; name: string; bloodGroup: string };
  unit: { bagNumber: string; status: string } | null;
}

export interface CollectionDetail extends Omit<CollectionRow, "donor" | "unit"> {
  donor: { id: string; donorCode: string; name: string; bloodGroup: string; mobile: string };
  camp: { id: string; name: string } | null;
  unit: {
    id: string;
    bagNumber: string;
    bloodGroup: string;
    volumeMl: number;
    status: string;
    labTest: { result: string } | null;
  } | null;
}

export interface CollectionListParams {
  status?: CollectionStatus | "";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}

/** Paginated collection (donation) history with manual refetch. */
export function useCollections(params: CollectionListParams) {
  const [data, setData] = useState<CollectionRow[]>();
  const [meta, setMeta] = useState<Paginated<CollectionRow>["meta"]>();
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
    api<Paginated<CollectionRow>>(`/collections?${qs}`)
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

export const getCollection = (id: string) => api<{ collection: CollectionDetail }>(`/collections/${id}`);

export const createCollection = (body: Record<string, unknown>) =>
  api<{ donation: { id: string }; unit: { bagNumber: string } }>("/collections", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const setCollectionStatus = (id: string, status: CollectionStatus) =>
  api<{ collection: CollectionRow }>(`/collections/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
