/**
 * Monorepo environment loader.
 *
 * In a pnpm workspace every package runs with its own folder as the cwd, so a plain
 * `dotenv/config` (which only looks at `process.cwd()/.env`) never finds the single
 * root `.env`. This walks up from the current working directory until it finds the
 * workspace root (identified by `pnpm-workspace.yaml`) and loads the `.env` next to it.
 *
 * Loaded with `override: false` so real environment variables always win. That means
 * the same code works unchanged inside Docker (where the compose file injects env vars
 * and there is no `.env` file) and on a developer machine (where the root `.env` is the
 * source of truth). Importing this module has no effect if neither source is present.
 *
 * Import this as the very first import of the config module so the `.env` is loaded
 * before anything reads `process.env`.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function findWorkspaceRoot(start: string): string | undefined {
  let dir = start;
  // Guard against symlink loops / filesystem root with a sane depth cap.
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return undefined;
}

const root = findWorkspaceRoot(process.cwd());
if (root) {
  const rootEnv = resolve(root, ".env");
  if (existsSync(rootEnv)) config({ path: rootEnv, override: false });
}

// Also honour a package-local `.env` if one exists (handy for per-app overrides),
// without overriding anything already set above or in the real environment.
config({ override: false });
