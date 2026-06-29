/**
 * Monorepo environment loader for the database package (Prisma seed + scripts).
 *
 * Mirrors `apps/api/src/config/loadEnv.ts`: it walks up from the current working
 * directory to the workspace root (identified by `pnpm-workspace.yaml`) and loads the
 * `.env` next to it, so `pnpm --filter @bloodline/db seed` works without first copying
 * the env file into `packages/db` or exporting variables by hand.
 *
 * Loaded with `override: false` so real environment variables (e.g. those injected by
 * Docker Compose, where no `.env` file exists) always win.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function findWorkspaceRoot(start: string): string | undefined {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

const root = findWorkspaceRoot(process.cwd());
if (root) {
  const rootEnv = resolve(root, ".env");
  if (existsSync(rootEnv)) config({ path: rootEnv, override: false });
}
config({ override: false });
