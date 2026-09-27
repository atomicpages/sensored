/**
 * Logging example: redact PII from structured log output before
 * writing to stdout.
 *
 * No API keys required.
 *
 * Usage:
 *   bun run logging.ts
 */

import { createRedactor } from "sensored";

const redactor = createRedactor({
  presets: ["pii"],
  rules: {
    person_name_lite: { action: "redact" },
    email: { action: "redact" },
    phone: { action: "redact" },
    us_ssn: { action: "format-preserve" },
    payment_card: { action: "token-replace" },
    postal_code: "off",
  },
});

interface LogEntry {
  readonly level: string;
  readonly message: string;
  readonly [key: string]: unknown;
}

function redactLog(entry: LogEntry): string {
  const serialized = JSON.stringify(entry);

  return redactor.redact(serialized);
}

console.log("--- Raw Logs (with PII) ---\n");

const entries: LogEntry[] = [
  {
    level: "info",
    message: "User John Smith logged in",
    email: "john.smith@example.com",
    ip: "192.168.1.100",
  },
  {
    level: "warn",
    message: "Failed payment for card 4111-1111-1111-1111",
    userId: "AB123456",
    ssn: "123-45-6789",
  },
  {
    level: "error",
    message: "Support contact: support@company.com or 555-867-5309",
    incident: "INC-2024-001",
  },
];

for (const entry of entries) {
  console.log(`  ${JSON.stringify(entry)}`);
}

console.log("\n--- Redacted Logs ---\n");

const redactStart = performance.now();

for (const entry of entries) {
  console.log(`  ${redactLog(entry)}`);
}

const redactMs = performance.now() - redactStart;

console.log("\n--- Logger Wrapper (drop-in usage) ---\n");

function logger(
  level: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  const entry: LogEntry = { level, message, ...meta };
  const redacted = redactLog(entry);

  process.stdout.write(`${redacted}\n`);
}

const loggerStart = performance.now();

logger("info", "Processing order for Jane Doe", {
  email: "jane.doe@example.com",
  phone: "555-123-4567",
});

logger("error", "Payment declined", {
  card: "4111-1111-1111-1111",
  amount: 99.99,
});

const loggerMs = performance.now() - loggerStart;

console.log(`\n--- Timings ---`);
console.log(`  batch redaction (3 entries): ${redactMs.toFixed(2)}ms`);
console.log(`  logger wrapper (2 calls):    ${loggerMs.toFixed(2)}ms`);
