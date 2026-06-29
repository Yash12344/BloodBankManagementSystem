/**
 * Validated environment configuration. The process fails fast at boot if anything
 * required is missing or malformed, so we never run with a half-configured app.
 */
// Must run before `process.env` is read below: loads the monorepo root `.env`.
import "./loadEnv.js";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),
  PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().positive().default(1800),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_SECONDS: z.coerce.number().int().positive().default(900),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),

  FEATURE_AI: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-opus-4-8"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
