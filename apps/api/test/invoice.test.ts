import { describe, expect, it } from "vitest";
import { computeInvoiceTotals, invoiceStatusFor, lineAmountMinor } from "../src/modules/billing/invoice.util.js";

describe("computeInvoiceTotals", () => {
  it("sums line amounts and rounds GST per line", () => {
    const totals = computeInvoiceTotals([
      { description: "PRBC O+", qty: 1, unitPriceMinor: 130000, gstRate: 5 },
      { description: "FFP A+", qty: 2, unitPriceMinor: 60000, gstRate: 5 },
    ]);
    expect(totals.subtotalMinor).toBe(130000 + 120000);
    expect(totals.gstMinor).toBe(6500 + 6000);
    expect(totals.totalMinor).toBe(totals.subtotalMinor + totals.gstMinor);
  });

  it("handles zero-priced lines", () => {
    const totals = computeInvoiceTotals([{ description: "free", qty: 1, unitPriceMinor: 0, gstRate: 5 }]);
    expect(totals).toEqual({ subtotalMinor: 0, gstMinor: 0, totalMinor: 0 });
  });

  it("computes a line amount as price × qty", () => {
    expect(lineAmountMinor({ description: "x", qty: 3, unitPriceMinor: 1000, gstRate: 0 })).toBe(3000);
  });

  it("keeps totals as integers (no float drift)", () => {
    const totals = computeInvoiceTotals([{ description: "odd", qty: 1, unitPriceMinor: 99, gstRate: 18 }]);
    expect(Number.isInteger(totals.gstMinor)).toBe(true);
    expect(totals.gstMinor).toBe(Math.round((99 * 18) / 100));
  });
});

describe("invoiceStatusFor", () => {
  it("is UNPAID with no payment", () => {
    expect(invoiceStatusFor(10000, 0)).toEqual({ balanceMinor: 10000, status: "UNPAID" });
  });
  it("is PARTIAL when some is paid", () => {
    expect(invoiceStatusFor(10000, 4000)).toEqual({ balanceMinor: 6000, status: "PARTIAL" });
  });
  it("is PAID when fully (or over) paid, never negative balance", () => {
    expect(invoiceStatusFor(10000, 10000)).toEqual({ balanceMinor: 0, status: "PAID" });
    expect(invoiceStatusFor(10000, 12000)).toEqual({ balanceMinor: 0, status: "PAID" });
  });
});
