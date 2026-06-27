import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { redis } from "./redis.js";
import { generateOtpCode, sha256 } from "./tokens.js";

/**
 * OTP challenges are short-lived and stored in Redis (hashed), never in the DB.
 * Used for login MFA and other step-up verification.
 */
interface OtpRecord {
  userId: string;
  codeHash: string;
  purpose: string;
  attempts: number;
}

const key = (challengeId: string) => `otp:${challengeId}`;
const MAX_OTP_ATTEMPTS = 5;

export interface OtpChallenge {
  challengeId: string;
  code: string; // returned to caller only so it can be delivered via email/SMS
}

export async function createOtpChallenge(userId: string, purpose: string): Promise<OtpChallenge> {
  const challengeId = randomUUID();
  const code = generateOtpCode(6);
  const record: OtpRecord = { userId, codeHash: sha256(code), purpose, attempts: 0 };
  await redis.set(key(challengeId), JSON.stringify(record), "EX", env.OTP_TTL_SECONDS);
  return { challengeId, code };
}

export type OtpResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "expired" | "invalid" | "locked" };

export async function verifyOtpChallenge(
  challengeId: string,
  code: string,
  purpose: string,
): Promise<OtpResult> {
  const raw = await redis.get(key(challengeId));
  if (!raw) return { ok: false, reason: "expired" };

  const record = JSON.parse(raw) as OtpRecord;
  if (record.purpose !== purpose) return { ok: false, reason: "invalid" };
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await redis.del(key(challengeId));
    return { ok: false, reason: "locked" };
  }

  if (sha256(code) !== record.codeHash) {
    record.attempts += 1;
    const ttl = await redis.ttl(key(challengeId));
    await redis.set(key(challengeId), JSON.stringify(record), "EX", Math.max(ttl, 1));
    return { ok: false, reason: "invalid" };
  }

  // Single-use: consume on success.
  await redis.del(key(challengeId));
  return { ok: true, userId: record.userId };
}
