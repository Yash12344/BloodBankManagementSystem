import { defineConfig } from "tsup";

// Bundle the internal workspace packages (which ship TypeScript source) into the
// API output so the runtime image contains plain JS. Keep real node_modules
// dependencies — especially the generated @prisma/client — external.
export default defineConfig({
  entry: ["src/server.ts", "src/worker.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  sourcemap: true,
  noExternal: [/^@bloodline\//],
  external: ["@prisma/client", ".prisma/client"],
});
