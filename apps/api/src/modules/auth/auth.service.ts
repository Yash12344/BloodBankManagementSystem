import { env } from "../../config/env.js";
import { writeAudit } from "../../lib/audit.js";
import { durationToMs } from "../../lib/duration.js";
import { Unauthorized } from "../../lib/errors.js";
import { signAccessToken } from "../../lib/jwt.js";
import { sendMail } from "../../lib/mailer.js";
import { createOtpChallenge, verifyOtpChallenge } from "../../lib/otp.js";
import { dummyVerify, hashPassword, verifyPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import { redis } from "../../lib/redis.js";
import { generateOpaqueToken, newFamilyId, sha256 } from "../../lib/tokens.js";
import { getEffectivePermissions } from "./permissions.js";

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  branchId: string;
  role: string;
  permissions: string[];
}

export type LoginResult =
  | { mfaRequired: true; challengeId: string }
  | { mfaRequired: false; tokens: SessionTokens; user: PublicUser };

const userSelect = {
  id: true,
  name: true,
  email: true,
  branchId: true,
  roleId: true,
  status: true,
  mfaEnabled: true,
  passwordHash: true,
  role: { select: { name: true } },
} as const;

// ---- Login lockout (Redis counter per email) ----
const lockKey = (email: string) => `login:fail:${email.toLowerCase()}`;

async function assertNotLocked(email: string): Promise<void> {
  const attempts = Number((await redis.get(lockKey(email))) ?? 0);
  if (attempts >= env.MAX_LOGIN_ATTEMPTS) {
    throw Unauthorized("Account temporarily locked due to failed attempts. Try again later.");
  }
}

async function registerFailure(email: string): Promise<void> {
  const k = lockKey(email);
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, env.LOGIN_LOCK_SECONDS);
}

async function clearFailures(email: string): Promise<void> {
  await redis.del(lockKey(email));
}

async function buildPublicUser(user: {
  id: string;
  name: string;
  email: string;
  branchId: string;
  roleId: string;
  role: { name: string };
}): Promise<PublicUser> {
  const perms = await getEffectivePermissions(user.id, user.roleId);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    branchId: user.branchId,
    role: user.role.name,
    permissions: [...perms],
  };
}

/** Issues an access token and a fresh refresh-token family, persisting the refresh hash. */
async function issueSession(
  user: { id: string; branchId: string; roleId: string; role: { name: string } },
  familyId = newFamilyId(),
): Promise<SessionTokens> {
  const accessToken = signAccessToken({
    sub: user.id,
    branchId: user.branchId,
    roleId: user.roleId,
    roleName: user.role.name,
  });
  const refreshToken = generateOpaqueToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      familyId,
      expiresAt: new Date(Date.now() + durationToMs(env.REFRESH_TOKEN_TTL)),
    },
  });
  return { accessToken, refreshToken };
}

export async function login(email: string, password: string, ctx: RequestContext): Promise<LoginResult> {
  await assertNotLocked(email);

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
    select: userSelect,
  });

  // Constant-ish work even when user is missing to reduce enumeration signal.
  const ok = user ? await verifyPassword(password, user.passwordHash) : await dummyVerify(password);

  if (!user || !ok || user.status !== "ACTIVE") {
    await registerFailure(email);
    throw Unauthorized("Invalid email or password");
  }

  await clearFailures(email);

  if (user.mfaEnabled) {
    const { challengeId, code } = await createOtpChallenge(user.id, "login");
    await sendMail({ to: user.email, subject: "Your BloodLine login code", text: `Your verification code is ${code}. It expires in ${env.OTP_TTL_SECONDS / 60} minutes.` });
    await writeAudit({ branchId: user.branchId, userId: user.id, entity: "auth", entityId: user.id, action: "LOGIN_OTP_SENT", ...ctx });
    return { mfaRequired: true, challengeId };
  }

  const tokens = await issueSession(user);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit({ branchId: user.branchId, userId: user.id, entity: "auth", entityId: user.id, action: "LOGIN", ...ctx });
  return { mfaRequired: false, tokens, user: await buildPublicUser(user) };
}

export async function verifyLoginOtp(
  challengeId: string,
  code: string,
  ctx: RequestContext,
): Promise<{ tokens: SessionTokens; user: PublicUser }> {
  const result = await verifyOtpChallenge(challengeId, code, "login");
  if (!result.ok) throw Unauthorized(result.reason === "locked" ? "Too many attempts" : "Invalid or expired code");

  const user = await prisma.user.findFirst({
    where: { id: result.userId, deletedAt: null, status: "ACTIVE" },
    select: userSelect,
  });
  if (!user) throw Unauthorized("Account is not active");

  const tokens = await issueSession(user);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit({ branchId: user.branchId, userId: user.id, entity: "auth", entityId: user.id, action: "LOGIN_MFA", ...ctx });
  return { tokens, user: await buildPublicUser(user) };
}

/**
 * Rotates a refresh token. Implements reuse detection: presenting an already-rotated
 * (revoked) token revokes the entire token family, forcing re-authentication.
 */
export async function rotateRefresh(rawToken: string, ctx: RequestContext): Promise<{ tokens: SessionTokens; user: PublicUser }> {
  const tokenHash = sha256(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing) throw Unauthorized("Invalid session");

  if (existing.revokedAt || existing.expiresAt < new Date()) {
    // Reuse or expiry: revoke the whole family defensively.
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit({ userId: existing.userId, entity: "auth", entityId: existing.userId, action: "REFRESH_REUSE_DETECTED", ...ctx });
    throw Unauthorized("Session expired, please sign in again");
  }

  const user = await prisma.user.findFirst({
    where: { id: existing.userId, deletedAt: null, status: "ACTIVE" },
    select: userSelect,
  });
  if (!user) throw Unauthorized("Account is not active");

  // Atomically claim the token: only one caller can flip revokedAt from null. If two
  // requests present the same valid token concurrently, the loser sees count === 0 and is
  // treated as reuse (revoke the whole family) rather than both minting new tokens.
  const claimed = await prisma.refreshToken.updateMany({
    where: { id: existing.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (claimed.count === 0) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit({ userId: existing.userId, entity: "auth", entityId: existing.userId, action: "REFRESH_REUSE_DETECTED", ...ctx });
    throw Unauthorized("Session expired, please sign in again");
  }

  const tokens = await issueSession(user, existing.familyId);
  return { tokens, user: await buildPublicUser(user) };
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId, deletedAt: null },
    select: { id: true, name: true, email: true, branchId: true, roleId: true, role: { select: { name: true } } },
  });
  return buildPublicUser(user);
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

const resetKey = (tokenHash: string) => `pwreset:${tokenHash}`;

/** Always resolves (no account enumeration). Emails a reset link when the user exists. */
export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
    select: { id: true, email: true },
  });
  if (!user) return;

  const token = generateOpaqueToken();
  await redis.set(resetKey(sha256(token)), user.id, "EX", env.PASSWORD_RESET_TTL_SECONDS);
  const link = `${env.APP_BASE_URL}/reset-password?token=${token}`;
  await sendMail({
    to: user.email,
    subject: "Reset your BloodLine password",
    text: `Reset your password using this link (valid ${env.PASSWORD_RESET_TTL_SECONDS / 60} minutes): ${link}`,
  });
}

export async function resetPassword(token: string, newPassword: string, ctx: RequestContext): Promise<void> {
  const k = resetKey(sha256(token));
  const userId = await redis.get(k);
  if (!userId) throw Unauthorized("Invalid or expired reset token");

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    // Invalidate all existing sessions on password change.
    await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit({ userId, entity: "auth", entityId: userId, action: "PASSWORD_RESET", ...ctx }, tx);
  });
  await redis.del(k);
}
