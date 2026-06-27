import type { Request, Response } from "express";
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from "../../lib/cookies.js";
import { Unauthorized } from "../../lib/errors.js";
import * as authService from "./auth.service.js";
import {
  forgotPasswordSchema,
  loginSchema,
  otpVerifySchema,
  resetPasswordSchema,
} from "./auth.dto.js";

const ctxOf = (req: Request) => ({ ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null });

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);
  const result = await authService.login(email, password, ctxOf(req));

  if (result.mfaRequired) {
    res.json({ mfaRequired: true, challengeId: result.challengeId });
    return;
  }
  setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
  res.json({ mfaRequired: false, user: result.user });
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const { challengeId, code } = otpVerifySchema.parse(req.body);
  const { tokens, user } = await authService.verifyLoginOtp(challengeId, code, ctxOf(req));
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.json({ user });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  if (!raw) throw Unauthorized("No session");
  const { tokens, user } = await authService.rotateRefresh(raw, ctxOf(req));
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.json({ user });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  await authService.logout(raw);
  clearAuthCookies(res);
  res.status(204).send();
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = forgotPasswordSchema.parse(req.body);
  await authService.forgotPassword(email);
  // Always 200 to avoid account enumeration.
  res.json({ ok: true });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(token, password, ctxOf(req));
  res.json({ ok: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw Unauthorized();
  const user = await authService.getMe(req.user.id);
  res.json({ user });
}
