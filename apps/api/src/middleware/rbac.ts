import type { NextFunction, Request, Response } from "express";
import { Forbidden, Unauthorized } from "../lib/errors.js";
import { hasPermission } from "../modules/auth/permissions.js";

/**
 * Guards a route by requiring a `module.action` permission. Must run after requireAuth.
 * Every protected route mounts this so authorization is enforced server-side, not just
 * hidden in the UI.
 */
export function requirePermission(module: string, action: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(Unauthorized());
    if (!hasPermission(req.user.permissions, module, action)) {
      return next(Forbidden(`Missing permission: ${module}.${action}`));
    }
    next();
  };
}
