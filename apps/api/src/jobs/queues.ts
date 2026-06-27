import { Queue } from "bullmq";
import { redis } from "../lib/redis.js";

/** Central registry of queue names so producers and the worker agree. */
export const QUEUE = {
  expirySweep: "expiry-sweep",
  lowStock: "low-stock",
  notifications: "notifications",
  reports: "reports",
} as const;

const connection = redis;

export const expirySweepQueue = new Queue(QUEUE.expirySweep, { connection });
export const lowStockQueue = new Queue(QUEUE.lowStock, { connection });
export const notificationsQueue = new Queue(QUEUE.notifications, { connection });
export const reportsQueue = new Queue(QUEUE.reports, { connection });

/**
 * Registers repeatable (cron) jobs. Idempotent: BullMQ dedupes by repeat options.
 * Nightly inventory expiry sweep at 01:00; low-stock scan every hour.
 */
export async function scheduleRepeatableJobs(): Promise<void> {
  await expirySweepQueue.add(
    "nightly",
    {},
    { repeat: { pattern: "0 1 * * *" }, removeOnComplete: 100, removeOnFail: 100 },
  );
  await lowStockQueue.add(
    "hourly",
    {},
    { repeat: { pattern: "0 * * * *" }, removeOnComplete: 100, removeOnFail: 100 },
  );
}
