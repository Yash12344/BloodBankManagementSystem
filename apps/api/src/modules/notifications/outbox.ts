import type { Prisma } from "@bloodline/db";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { deliver, type DeliveryPayload } from "./channels.js";

const MAX_ATTEMPTS = 5;

/**
 * Enqueues an external (email/SMS/WhatsApp) notification using the transactional outbox
 * pattern: the row is written (often in the same transaction as the triggering change) and
 * a worker delivers it exactly once. `dedupeKey` guards against duplicates.
 */
export async function enqueueDelivery(
  payload: DeliveryPayload & { dedupeKey: string },
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await client.notificationOutbox.upsert({
    where: { dedupeKey: payload.dedupeKey },
    create: { dedupeKey: payload.dedupeKey, payload: payload as unknown as Prisma.InputJsonValue, status: "PENDING" },
    update: {}, // already queued; do nothing
  });
}

/** Exponential backoff in seconds for a given attempt number. */
function backoffSeconds(attempt: number): number {
  return Math.min(3600, 30 * 2 ** attempt);
}

/**
 * Processes due outbox rows: delivers each via its channel adapter, marking SENT on
 * success or scheduling a backed-off retry on failure (FAILED after MAX_ATTEMPTS).
 * Returns the number successfully delivered.
 */
export async function processOutbox(now: Date = new Date(), limit = 50): Promise<number> {
  const due = await prisma.notificationOutbox.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });

  let sent = 0;
  for (const row of due) {
    const payload = row.payload as unknown as DeliveryPayload;
    try {
      await deliver(payload);
      await prisma.notificationOutbox.update({ where: { id: row.id }, data: { status: "SENT", attempts: row.attempts + 1 } });
      sent++;
    } catch (err) {
      const attempts = row.attempts + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      await prisma.notificationOutbox.update({
        where: { id: row.id },
        data: {
          attempts,
          status: failed ? "FAILED" : "PENDING",
          nextAttemptAt: new Date(now.getTime() + backoffSeconds(attempts) * 1000),
        },
      });
      logger.warn({ err, outboxId: row.id, attempts, failed }, "outbox delivery failed");
    }
  }

  if (due.length) logger.info({ scanned: due.length, sent }, "outbox processed");
  return sent;
}
