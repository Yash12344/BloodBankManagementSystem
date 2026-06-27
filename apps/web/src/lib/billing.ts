"use client";

import type { Paginated } from "@bloodline/types";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export interface Invoice {
  id: string;
  number: string;
  status: "DRAFT" | "UNPAID" | "PARTIAL" | "PAID" | "VOID";
  subtotalMinor: number;
  gstMinor: number;
  totalMinor: number;
  balanceMinor: number;
  issuedAt: string;
  hospital?: { name: string } | null;
}

export interface InvoiceDetail extends Invoice {
  lines: { id: string; description: string; qty: number; unitPriceMinor: number; gstRate: number; amountMinor: number }[];
  payments: { id: string; method: string; amountMinor: number; receivedAt: string; reference: string | null }[];
}

export function useInvoices(status?: string) {
  const [data, setData] = useState<Invoice[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();

  const qs = status ? `?status=${status}` : "";
  const load = useCallback(() => {
    setLoading(true);
    setError(undefined);
    api<Paginated<Invoice>>(`/billing/invoices${qs}`)
      .then((r) => setData(r.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [qs]);

  useEffect(() => load(), [load]);
  return { data, loading, error, refetch: load };
}

export const getInvoice = (id: string) => api<{ invoice: InvoiceDetail }>(`/billing/invoices/${id}`);

export function recordPayment(invoiceId: string, body: { method: string; amountMinor: number; reference?: string }) {
  // A fresh idempotency key per attempt; safe to retry on network failure.
  const key = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
  return api(`/billing/invoices/${invoiceId}/payments`, {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}

export interface DailyCash {
  date: string;
  byMethod: Record<string, number>;
  totalIn: number;
  totalExpense: number;
  net: number;
}

export const getDailyCash = () => api<DailyCash>("/billing/daily-cash");
