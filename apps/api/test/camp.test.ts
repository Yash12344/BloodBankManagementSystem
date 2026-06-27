import { describe, expect, it } from "vitest";
import { summarizeCampFinance } from "../src/modules/camps/camp.util.js";

describe("summarizeCampFinance", () => {
  it("computes net as revenue minus expenses", () => {
    const f = summarizeCampFinance([50000, 30000, 20000], 0);
    expect(f.expenseMinor).toBe(100000);
    expect(f.revenueMinor).toBe(0);
    expect(f.netMinor).toBe(-100000);
  });

  it("handles revenue exceeding expenses", () => {
    const f = summarizeCampFinance([10000], 25000);
    expect(f.netMinor).toBe(15000);
  });

  it("handles no expenses", () => {
    expect(summarizeCampFinance([], 0)).toEqual({ expenseMinor: 0, revenueMinor: 0, netMinor: 0 });
  });
});
