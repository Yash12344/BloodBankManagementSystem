import type { Response } from "express";
import { env, isProd } from "../config/env.js";
import { durationToMs } from "./duration.js";

export const ACCESS_COOKIE = "bl_access";
export const REFRESH_COOKIE = "bl_refresh";

// Secure cookies in production by default; override with COOKIE_SECURE for proxies/TLS dev.
const secure = env.COOKIE_SECURE ?? isProd;

const base = {
  httpOnly: true,
  secure,
  sameSite: "strict" as const,
  path: "/",
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...base,
    maxAge: durationToMs(env.ACCESS_TOKEN_TTL),
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    maxAge: durationToMs(env.REFRESH_TOKEN_TTL),
    // Scope the refresh cookie to the refresh endpoint to limit exposure.
    path: "/api/v1/auth",
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...base });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: "/api/v1/auth" });
}
