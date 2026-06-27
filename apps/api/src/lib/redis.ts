import { Redis } from "ioredis";
import { env } from "../config/env.js";

/**
 * Shared Redis connection for caching and as the BullMQ backing store.
 * `maxRetriesPerRequest: null` is required by BullMQ for blocking commands.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
});

// Prevent an unhandled 'error' event from crashing the process when Redis is
// briefly unreachable; reconnection is handled by ioredis.
redis.on("error", () => undefined);
