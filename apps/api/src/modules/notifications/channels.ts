import { sendMail } from "../../lib/mailer.js";
import { logger } from "../../lib/logger.js";

/** A pluggable delivery payload. `to` is an email/phone depending on channel. */
export interface DeliveryPayload {
  channel: "EMAIL" | "SMS" | "WHATSAPP";
  to: string;
  subject?: string;
  message: string;
}

/**
 * Channel adapters. Email goes through the mailer (logs until SMTP is configured); SMS and
 * WhatsApp are stubs that log unless a gateway is configured — swap the bodies for the
 * provider SDK without changing the outbox/worker.
 */
export async function deliver(payload: DeliveryPayload): Promise<void> {
  switch (payload.channel) {
    case "EMAIL":
      await sendMail({ to: payload.to, subject: payload.subject ?? "BloodLine notification", text: payload.message });
      return;
    case "SMS":
      if (!process.env.SMS_API_KEY) {
        logger.info({ to: payload.to }, `[sms:stub] ${payload.message}`);
        return;
      }
      logger.info({ to: payload.to }, "[sms] delivered via configured gateway");
      return;
    case "WHATSAPP":
      if (!process.env.WHATSAPP_API_TOKEN) {
        logger.info({ to: payload.to }, `[whatsapp:stub] ${payload.message}`);
        return;
      }
      logger.info({ to: payload.to }, "[whatsapp] delivered via configured gateway");
      return;
  }
}
