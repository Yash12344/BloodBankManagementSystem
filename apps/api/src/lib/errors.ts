/**
 * Typed application errors. Throw these from services/controllers; the error
 * middleware maps them to the standard `{ error: { code, message } }` envelope.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const BadRequest = (msg: string, details?: unknown) => new AppError(400, "BAD_REQUEST", msg, details);
export const Unauthorized = (msg = "Authentication required") => new AppError(401, "UNAUTHORIZED", msg);
export const Forbidden = (msg = "You do not have permission") => new AppError(403, "FORBIDDEN", msg);
export const NotFound = (msg = "Resource not found") => new AppError(404, "NOT_FOUND", msg);
export const Conflict = (msg: string) => new AppError(409, "CONFLICT", msg);
export const DomainError = (msg: string, details?: unknown) => new AppError(422, "DOMAIN_RULE", msg, details);
