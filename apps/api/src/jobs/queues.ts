import { Queue } from "bullmq";
import { redis } from "../lib/redis.js";

/** Central registry of queue names so producers and the worker agree. */
export const QUEUE = {
  expirySweep: "expiry-sweep",
  notifications: "notifications",
  reports: "reports",
} as const;

const connection = redis;

export const expirySweepQueue = new Queue(QUEUE.expirySweep, { connection });
export const notificationsQueue = new Queue(QUEUE.notifications, { connection });
export const reportsQueue = new Queue(QUEUE.reports, { connection });

/**
 * Registers repeatable (cron) jobs. Idempotent: BullMQ dedupes by repeat options.
 * Currently schedules the nightly inventory expiry sweep at 01:00.
 */
export async function scheduleRepeatableJobs(): Promise<void> {
  await expirySweepQueue.add(
    "nightly",
    {},
    { repeat: { pattern: "0 1 * * *" }, removeOnComplete: 100, removeOnFail: 100 },
  );
}
