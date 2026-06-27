import { createHash, randomBytes, randomUUID } from "node:crypto";

/** Generates a high-entropy opaque token (for refresh tokens and reset links). */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hex digest. We store only hashes of refresh/reset tokens, never the raw value. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function newFamilyId(): string {
  return randomUUID();
}

/** Numeric OTP code of the given length (default 6), zero-padded. */
export function generateOtpCode(length = 6): string {
  const max = 10 ** length;
  const n = randomBytes(4).readUInt32BE(0) % max;
  return n.toString().padStart(length, "0");
}
