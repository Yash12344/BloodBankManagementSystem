import { Worker } from "bullmq";
import { QUEUE, scheduleRepeatableJobs } from "./jobs/queues.js";
import { runExpirySweep } from "./jobs/expirySweep.js";
import { redis } from "./lib/redis.js";
import { logger } from "./lib/logger.js";

/**
 * Background worker process. Runs separately from the API so long-running jobs
 * (expiry sweeps, notifications, report generation) never block request handling.
 */
async function main() {
  await scheduleRepeatableJobs();

  const expiryWorker = new Worker(
    QUEUE.expirySweep,
    async () => {
      const expired = await runExpirySweep();
      return { expired };
    },
    { connection: redis, concurrency: 1 },
  );

  expiryWorker.on("completed", (job, result) =>
    logger.info({ jobId: job.id, result }, "expiry-sweep job completed"),
  );
  expiryWorker.on("failed", (job, err) =>
    logger.error({ jobId: job?.id, err }, "expiry-sweep job failed"),
  );

  logger.info("BloodLine worker started");

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, closing worker...`);
    await expiryWorker.close();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal worker startup error");
  process.exit(1);
});
