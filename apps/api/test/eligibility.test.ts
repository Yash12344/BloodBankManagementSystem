import { describe, expect, it } from "vitest";
import {
  computeNextEligible,
  evaluateEligibility,
  intervalDays,
} from "../src/modules/donors/eligibility.js";

const NOW = new Date("2026-06-27T00:00:00Z");
const dobFor = (age: number) => new Date(Date.UTC(2026 - age, 5, 27));

describe("evaluateEligibility", () => {
  it("accepts a healthy first-time donor", () => {
    const r = evaluateEligibility({
      dob: dobFor(30),
      gender: "MALE",
      weightKg: 70,
      status: "ACTIVE",
      lastDonationAt: null,
      now: NOW,
    });
    expect(r.eligible).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it("rejects underage and underweight donors with all reasons", () => {
    const r = evaluateEligibility({
      dob: dobFor(16),
      gender: "FEMALE",
      weightKg: 40,
      status: "ACTIVE",
      lastDonationAt: null,
      now: NOW,
    });
    expect(r.eligible).toBe(false);
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it("blocks blacklisted donors", () => {
    const r = evaluateEligibility({
      dob: dobFor(30),
      gender: "MALE",
      weightKg: 70,
      status: "BLACKLISTED",
      lastDonationAt: null,
      now: NOW,
    });
    expect(r.eligible).toBe(false);
  });

  it("enforces the donation interval and reports next-eligible date", () => {
    const lastDonation = new Date("2026-06-01T00:00:00Z"); // 26 days ago < 90
    const r = evaluateEligibility({
      dob: dobFor(30),
      gender: "MALE",
      weightKg: 70,
      status: "ACTIVE",
      lastDonationAt: lastDonation,
      now: NOW,
    });
    expect(r.eligible).toBe(false);
    expect(r.nextEligibleAt).toEqual(computeNextEligible(lastDonation, "MALE"));
  });

  it("becomes eligible after the interval passes", () => {
    const lastDonation = new Date("2026-01-01T00:00:00Z"); // > 90 days ago
    const r = evaluateEligibility({
      dob: dobFor(30),
      gender: "MALE",
      weightKg: 70,
      status: "ACTIVE",
      lastDonationAt: lastDonation,
      now: NOW,
    });
    expect(r.eligible).toBe(true);
  });

  it("uses a longer interval for non-male donors", () => {
    expect(intervalDays("MALE")).toBe(90);
    expect(intervalDays("FEMALE")).toBe(120);
  });
});
