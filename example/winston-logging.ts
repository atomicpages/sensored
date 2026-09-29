/**
 * Winston logging example: redact PII from structured log records using
 * the sensored winston adapter.
 *
 * No API keys required.
 *
 * Usage:
 *   bun run winston-logging.ts
 */

import { winstonRedact } from "sensored/loggers/winston";
import winston from "winston";

const redact = winstonRedact({
  presets: ["pii"],
  rules: {
    person_name_lite: { action: "redact" },
    email: { action: "redact" },
    phone: { action: "redact" },
    payment_card: { action: "token-replace" },
  },
});

const redactFormat = winston.format((info) => {
  Object.assign(info, redact(info));
  return info;
})();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    redactFormat,
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

console.log("--- Winston logs (PII redacted by sensored) ---\n");

logger.info("User logged in", {
  user: "John Smith",
  email: "john.smith@example.com",
  phone: "555-867-5309",
  event: "login",
});

logger.warn("Payment declined", {
  customer: "Jane Doe",
  card: "4111-1111-1111-1111",
  amount: 99.99,
  event: "payment_failed",
});

logger.error("Support ticket created", {
  contact: "support@company.com",
  ssn: "123-45-6789",
  incident: "INC-2024-001",
});
