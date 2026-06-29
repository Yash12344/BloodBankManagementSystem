/**
 * Postinstall guard: make sure a root `.env` exists for local development.
 *
 * On a fresh clone there is no `.env` (it is gitignored). Rather than make every
 * developer remember to copy the template, we create it from `.env.example` on the
 * first `pnpm install`. This is what lets the documented quickstart —
 *   pnpm install → docker compose up -d → pnpm db:push → pnpm db:seed → pnpm dev
 * — work with zero manual configuration.
 *
 * Cross-platform (plain Node, no shell builtins) and idempotent: it never overwrites an
 * existing `.env`, and it is a no-op when the template is absent (e.g. CI/Docker images
 * that inject configuration through the real environment instead of a file).
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const examplePath = resolve(root, ".env.example");

if (existsSync(envPath)) {
  // Already configured — leave the developer's file untouched.
  process.exit(0);
}

if (!existsSync(examplePath)) {
  // Nothing to copy from; configuration is expected to come from the real environment.
  process.exit(0);
}

copyFileSync(examplePath, envPath);
// eslint-disable-next-line no-console
console.log("[bloodline] Created .env from .env.example — edit it to set real secrets.");
