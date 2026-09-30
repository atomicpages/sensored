/**
 * log4js logging example: redact PII from log4js log events using
 * the sensored log4js wrapper appender.
 *
 * No API keys required.
 *
 * Usage:
 *   bun run log4js-logging.ts
 */

import log4js from "log4js";
import { configure } from "sensored/loggers/log4js";

log4js.configure({
  appenders: {
    stdout: { type: "stdout" },
    redacted: {
      type: "sensored/loggers/log4js",
      appender: "stdout",
      redact: {
        presets: ["pii"],
        rules: {
          person_name_lite: { action: "redact" },
          email: { action: "redact" },
          phone: { action: "redact" },
          payment_card: { action: "token-replace" },
        },
      },
    },
  },
  categories: {
    default: { appenders: ["redacted"], level: "info" },
  },
});

const logger = log4js.getLogger();

console.log("--- log4js logs (PII redacted by sensored) ---\n");

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
