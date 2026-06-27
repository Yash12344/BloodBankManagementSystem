import { logger } from "./logger.js";

/**
 * Minimal mailer abstraction. In development (and until SMTP is wired in Phase 9)
 * it logs the message so flows are testable end to end without a real gateway.
 * Swap the implementation for nodemailer/provider SDK without touching callers.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(msg: MailMessage): Promise<void> {
  logger.info({ to: msg.to, subject: msg.subject }, "[mail] " + msg.text);
}
