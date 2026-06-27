import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessTokenClaims {
  sub: string; // user id
  branchId: string;
  roleId: string;
  roleName: string;
}

/** Signs a short-lived access token carrying identity + role for fast authz. */
export function signAccessToken(claims: AccessTokenClaims): string {
  const options: SignOptions = { expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"] };
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, options);
}

/** Verifies an access token, throwing if invalid/expired. */
export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenClaims;
}
