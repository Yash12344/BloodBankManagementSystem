import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";

async function main() {
  const app = createApp();

  const server = app.listen(env.API_PORT, () => {
    logger.info(`BloodLine API listening on :${env.API_PORT}`);
  });

  // Graceful shutdown: stop accepting connections, then close resources.
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    server.close(async () => {
      await prisma.$disconnect().catch(() => undefined);
      redis.disconnect();
      logger.info("Shutdown complete");
      process.exit(0);
    });
    // Force-exit if cleanup hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
