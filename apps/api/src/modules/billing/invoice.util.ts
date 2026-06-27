/**
 * Pure invoice arithmetic. Money is in integer minor units (paise) throughout — never
 * floats — so totals always reconcile exactly.
 */
export interface InvoiceLineInput {
  description: string;
  qty: number;
  unitPriceMinor: number;
  gstRate: number; // percent, e.g. 5 for 5%
}

export interface InvoiceTotals {
  subtotalMinor: number;
  gstMinor: number;
  totalMinor: number;
}

export function lineAmountMinor(line: InvoiceLineInput): number {
  return line.unitPriceMinor * line.qty;
}

export type PaidStatus = "UNPAID" | "PARTIAL" | "PAID";

/** Derives balance and payment status from the invoice total and amount paid. */
export function invoiceStatusFor(totalMinor: number, paidMinor: number): { balanceMinor: number; status: PaidStatus } {
  const balanceMinor = Math.max(0, totalMinor - paidMinor);
  if (paidMinor <= 0) return { balanceMinor, status: "UNPAID" };
  if (paidMinor >= totalMinor) return { balanceMinor: 0, status: "PAID" };
  return { balanceMinor, status: "PARTIAL" };
}

/** GST per line is rounded to the nearest paisa, then summed (avoids cumulative drift). */
export function computeInvoiceTotals(lines: InvoiceLineInput[]): InvoiceTotals {
  let subtotalMinor = 0;
  let gstMinor = 0;
  for (const line of lines) {
    const amount = lineAmountMinor(line);
    subtotalMinor += amount;
    gstMinor += Math.round((amount * line.gstRate) / 100);
  }
  return { subtotalMinor, gstMinor, totalMinor: subtotalMinor + gstMinor };
}
