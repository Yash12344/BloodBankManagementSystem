import type { NextFunction, Request, Response } from "express";
import { ACCESS_COOKIE } from "../lib/cookies.js";
import { Unauthorized } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { getEffectivePermissions } from "../modules/auth/permissions.js";

export interface AuthUser {
  id: string;
  branchId: string;
  roleId: string;
  roleName: string;
  permissions: Set<string>;
}

// Augment Express' Request with the authenticated user.
declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

function extractToken(req: Request): string | undefined {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return undefined;
}

/**
 * Authenticates the request from the access cookie (or Bearer token). Loads the user's
 * current status and effective permissions from the DB so role/permission changes and
 * suspensions take effect on the next request — no need to wait for token expiry.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) throw Unauthorized();

    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch {
      throw Unauthorized("Invalid or expired token");
    }

    const user = await prisma.user.findFirst({
      where: { id: claims.sub, deletedAt: null },
      select: { id: true, branchId: true, roleId: true, status: true, role: { select: { name: true } } },
    });
    if (!user || user.status !== "ACTIVE") throw Unauthorized("Account is not active");

    const permissions = await getEffectivePermissions(user.id, user.roleId);
    req.user = {
      id: user.id,
      branchId: user.branchId,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions,
    };
    next();
  } catch (err) {
    next(err);
  }
}
