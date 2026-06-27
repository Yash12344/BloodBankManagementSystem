import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

/**
 * Password hashing. bcryptjs is used (pure JS, no native build) so the image stays
 * portable; cost is configurable via BCRYPT_ROUNDS.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// A precomputed valid hash used to spend comparable time when a user is not found,
// reducing the timing signal that aids account enumeration.
const DUMMY_HASH = bcrypt.hashSync("bloodline-dummy-password", 10);

export async function dummyVerify(plain: string): Promise<boolean> {
  return bcrypt.compare(plain, DUMMY_HASH);
}
