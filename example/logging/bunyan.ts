/**
 * Bunyan logging example: redact PII from raw bunyan log records using
 * the sensored bunyan adapter.
 *
 * No API keys required.
 *
 * Usage:
 *   bun run bunyan-logging.ts
 */

import { type BunyanRawStream, bunyanRedact } from "sensored/loggers/bunyan";

const redactStream: BunyanRawStream = bunyanRedact(
  {
    presets: ["pii"],
    rules: {
      person_name_lite: { action: "redact" },
      email: { action: "redact" },
      phone: { action: "redact" },
      payment_card: { action: "token-replace" },
    },
  },
  process.stdout,
);

console.log("--- Bunyan logs (PII redacted by sensored) ---\n");

redactStream.write({
  msg: "User logged in",
  level: 30,
  user: "John Smith",
  email: "john.smith@example.com",
  phone: "555-867-5309",
  event: "login",
});

redactStream.write({
  msg: "Payment declined",
  level: 40,
  customer: "Jane Doe",
  card: "4111-1111-1111-1111",
  amount: 99.99,
  event: "payment_failed",
});

redactStream.write({
  msg: "Support ticket created",
  level: 50,
  contact: "support@company.com",
  ssn: "123-45-6789",
  incident: "INC-2024-001",
});
