/**
 * Console logging example: redact PII from console.* output using
 * the sensored console adapter.
 *
 * No API keys required.
 *
 * Usage:
 *   bun run console-logging.ts
 */

import { wrapConsole } from "sensored/loggers/console";

const restore = wrapConsole({
  presets: ["pii"],
  rules: {
    person_name_lite: { action: "redact" },
    email: { action: "redact" },
    phone: { action: "redact" },
    payment_card: { action: "token-replace" },
  },
});

console.log("--- Console logs (PII redacted by sensored) ---\n");

console.log("User logged in", {
  user: "John Smith",
  email: "john.smith@example.com",
  phone: "555-867-5309",
  event: "login",
});

console.warn("Payment declined", {
  customer: "Jane Doe",
  card: "4111-1111-1111-1111",
  amount: 99.99,
  event: "payment_failed",
});

console.error("Support ticket created", {
  contact: "support@company.com",
  ssn: "123-45-6789",
  incident: "INC-2024-001",
});

console.group("alice@example.com");
console.log("inside group");
console.groupEnd();

restore();

console.log("\n--- Console restored (raw PII) ---\n");
console.log("alice@example.com");
