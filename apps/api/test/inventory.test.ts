import { describe, expect, it } from "vitest";
import { summarizeTti } from "../src/modules/lab/lab.util.js";
import { computeComponentExpiry } from "../src/modules/components/component.util.js";
import { stockLevel } from "../src/modules/inventory/stock.js";

describe("summarizeTti", () => {
  const base = { hiv: "NON_REACTIVE", hbsag: "NON_REACTIVE", hcv: "NON_REACTIVE", malaria: "NON_REACTIVE", syphilis: "NON_REACTIVE" } as const;

  it("flags all non-reactive as approvable", () => {
    const s = summarizeTti({ ...base });
    expect(s.allNonReactive).toBe(true);
    expect(s.anyReactive).toBe(false);
    expect(s.anyPending).toBe(false);
  });

  it("detects a reactive marker", () => {
    const s = summarizeTti({ ...base, hiv: "REACTIVE" });
    expect(s.anyReactive).toBe(true);
    expect(s.allNonReactive).toBe(false);
  });

  it("detects pending markers", () => {
    const s = summarizeTti({ ...base, syphilis: "PENDING" });
    expect(s.anyPending).toBe(true);
    expect(s.allNonReactive).toBe(false);
  });
});

describe("computeComponentExpiry", () => {
  const prepared = new Date("2026-06-01T00:00:00Z");

  it("uses platelets short shelf life (5 days)", () => {
    expect(computeComponentExpiry("PLATELETS", prepared).toISOString()).toBe("2026-06-06T00:00:00.000Z");
  });

  it("uses PRBC 42-day shelf life", () => {
    expect(computeComponentExpiry("PRBC", prepared).toISOString()).toBe("2026-07-13T00:00:00.000Z");
  });
});

describe("stockLevel", () => {
  it("classifies critical/low/ok against defaults", () => {
    expect(stockLevel(0)).toBe("critical");
    expect(stockLevel(2)).toBe("critical");
    expect(stockLevel(4)).toBe("low");
    expect(stockLevel(5)).toBe("low");
    expect(stockLevel(20)).toBe("ok");
  });
});
