/**
 * Pino logging example: redact PII from structured log records using
 * the sensored pino adapter.
 *
 * No API keys required.
 *
 * Usage:
 *   bun run pino-logging.ts
 */

import pino from "pino";
import { pinoRedact } from "sensored/loggers/pino";

const logger = pino({
  ...pinoRedact({
    presets: ["pii"],
    rules: {
      person_name_lite: { action: "redact" },
      email: { action: "redact" },
      phone: { action: "redact" },
      payment_card: { action: "token-replace" },
    },
  }),
});

console.log("--- Pino logs (PII redacted by sensored) ---\n");

logger.info(
  {
    user: "John Smith",
    email: "john.smith@example.com",
    phone: "555-867-5309",
    event: "login",
  },
  "User logged in",
);

logger.warn(
  {
    customer: "Jane Doe",
    card: "4111-1111-1111-1111",
    amount: 99.99,
    event: "payment_failed",
  },
  "Payment declined",
);

logger.error(
  {
    contact: "support@company.com",
    ssn: "123-45-6789",
    incident: "INC-2024-001",
  },
  "Support ticket created",
);
