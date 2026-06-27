import { describe, expect, it } from "vitest";
import { minutesOutOfStorage, withinColdChainWindow } from "../src/modules/issue/coldchain.js";

describe("cold-chain window", () => {
  const issued = new Date("2026-06-27T10:00:00Z");

  it("allows restock within the window", () => {
    expect(withinColdChainWindow(issued, new Date("2026-06-27T10:20:00Z"))).toBe(true);
  });

  it("blocks restock past the window", () => {
    expect(withinColdChainWindow(issued, new Date("2026-06-27T10:45:00Z"))).toBe(false);
  });

  it("blocks a negative (clock-skew) interval", () => {
    expect(withinColdChainWindow(issued, new Date("2026-06-27T09:50:00Z"))).toBe(false);
  });

  it("computes elapsed minutes", () => {
    expect(minutesOutOfStorage(issued, new Date("2026-06-27T10:30:00Z"))).toBe(30);
  });
});
