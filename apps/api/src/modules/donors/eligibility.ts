/**
 * Donor eligibility engine (FR-DON-2). Pure and deterministic so it is unit-testable and
 * reused by both donor display and the collection guard. All dates are compared in UTC.
 */

export type Gender = "MALE" | "FEMALE" | "OTHER";
export type DonorStatus = "ACTIVE" | "DEFERRED" | "BLACKLISTED" | "INACTIVE";

export const ELIGIBILITY = {
  MIN_AGE: 18,
  MAX_AGE: 65,
  MIN_WEIGHT_KG: 45,
  INTERVAL_DAYS_MALE: 90,
  INTERVAL_DAYS_OTHER: 120,
} as const;

const DAY_MS = 86_400_000;

export function ageInYears(dob: Date, now: Date): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/** Days a donor must wait between whole-blood donations, by gender. */
export function intervalDays(gender: Gender): number {
  return gender === "MALE" ? ELIGIBILITY.INTERVAL_DAYS_MALE : ELIGIBILITY.INTERVAL_DAYS_OTHER;
}

/** The earliest date a donor becomes eligible again after a donation. */
export function computeNextEligible(lastDonationAt: Date, gender: Gender): Date {
  return new Date(lastDonationAt.getTime() + intervalDays(gender) * DAY_MS);
}

export interface EligibilityInput {
  dob: Date;
  gender: Gender;
  weightKg: number;
  status: DonorStatus;
  lastDonationAt?: Date | null;
  activeDeferralUntil?: Date | null;
  now?: Date;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  nextEligibleAt: Date | null;
}

/**
 * Evaluates whether a donor may donate now. Returns every failing reason (not just the
 * first) so the UI/staff see the full picture, plus the computed next-eligible date.
 */
export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const now = input.now ?? new Date();
  const reasons: string[] = [];

  const age = ageInYears(input.dob, now);
  if (age < ELIGIBILITY.MIN_AGE) reasons.push(`Donor is under ${ELIGIBILITY.MIN_AGE} years`);
  if (age > ELIGIBILITY.MAX_AGE) reasons.push(`Donor is over ${ELIGIBILITY.MAX_AGE} years`);
  if (input.weightKg < ELIGIBILITY.MIN_WEIGHT_KG)
    reasons.push(`Weight below ${ELIGIBILITY.MIN_WEIGHT_KG} kg`);

  if (input.status === "BLACKLISTED") reasons.push("Donor is blacklisted");
  if (input.status === "DEFERRED") reasons.push("Donor is deferred");

  if (input.activeDeferralUntil && input.activeDeferralUntil > now) {
    reasons.push(`Deferred until ${input.activeDeferralUntil.toISOString().slice(0, 10)}`);
  }

  let nextEligibleAt: Date | null = null;
  if (input.lastDonationAt) {
    nextEligibleAt = computeNextEligible(input.lastDonationAt, input.gender);
    if (nextEligibleAt > now) {
      reasons.push(`Last donation too recent; eligible from ${nextEligibleAt.toISOString().slice(0, 10)}`);
    }
  }

  return { eligible: reasons.length === 0, reasons, nextEligibleAt };
}
