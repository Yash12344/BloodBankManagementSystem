import { describe, expect, it } from "vitest";
import { daysToStockout, forecastDemand, linearTrend, mean, stockRisk } from "../src/modules/ai/forecast.js";
import { rankDonors, type DonorCandidate } from "../src/modules/ai/donorRank.js";

describe("forecast helpers", () => {
  it("computes mean", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([])).toBe(0);
  });

  it("detects an upward linear trend", () => {
    const { slope } = linearTrend([1, 2, 3, 4, 5]);
    expect(slope).toBeCloseTo(1, 5);
  });

  it("forecasts non-negative demand", () => {
    expect(forecastDemand([0, 0, 0], 7)).toBe(0);
    expect(forecastDemand([2, 2, 2, 2], 7)).toBe(14);
  });

  it("computes days to stockout and risk bands", () => {
    expect(daysToStockout(10, 0)).toBeNull(); // no consumption
    expect(daysToStockout(10, 2)).toBe(5);
    expect(stockRisk(2, 3)).toBe("critical");
    expect(stockRisk(5, 3)).toBe("warning");
    expect(stockRisk(20, 3)).toBe("ok");
    expect(stockRisk(null)).toBe("ok");
  });
});

describe("donor ranking", () => {
  const now = new Date("2026-06-27T00:00:00Z");
  const base: DonorCandidate = { id: "1", name: "X", bloodGroup: "O_POS", donationCount: 0, lastDonationAt: null, nextEligibleAt: null };

  it("ranks exact group match above universal donor", () => {
    const ranked = rankDonors(
      [
        { ...base, id: "a", bloodGroup: "O_POS" },
        { ...base, id: "b", bloodGroup: "O_NEG" },
      ],
      "O_POS",
      now,
    );
    expect(ranked[0]!.id).toBe("a");
  });

  it("excludes ineligible (future next-eligible) donors", () => {
    const ranked = rankDonors(
      [{ ...base, id: "c", nextEligibleAt: new Date("2026-12-01T00:00:00Z") }],
      "O_POS",
      now,
    );
    expect(ranked).toHaveLength(0);
  });

  it("excludes incompatible groups", () => {
    const ranked = rankDonors([{ ...base, id: "d", bloodGroup: "A_POS" }], "O_POS", now);
    expect(ranked).toHaveLength(0);
  });

  it("rewards reliability (donation count)", () => {
    const ranked = rankDonors(
      [
        { ...base, id: "low", donationCount: 0 },
        { ...base, id: "high", donationCount: 8 },
      ],
      "O_POS",
      now,
    );
    expect(ranked[0]!.id).toBe("high");
  });
});
