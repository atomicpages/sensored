/**
 * Phase 1: Multi-action redaction, custom detectors, allowlists, inspection,
 * and error handling.
 *
 * No API keys required.
 *
 * Usage:
 *   bun run phase1-multiaction.ts
 */

import {
  createRedactor,
  type DetectorDefinition,
  MAX_INPUT_LENGTH,
  SensoredError,
} from "sensored";

// Custom detector for employee IDs — demonstrates the full extension contract.
const employeeIdDetector: DetectorDefinition = {
  id: "employee_id",
  entityType: "employee_id",
  replacement: "[EMPLOYEE_ID]",
  pattern: /(?<![\p{L}\p{M}\p{N}_])[A-Z]{2}\d{6}(?![\p{L}\p{M}\p{N}_])/u,
  context: { before: 20, after: 0 },
  stream: {
    maxMatchLength: 8,
    leftContext: 20,
    rightContext: 0,
    boundaryLookaround: 1,
  },
  validate({ before }) {
    return /Employee ID/i.test(before) ? ["employee_id.context"] : false;
  },
  contextHint: {
    labels: ["Employee ID"],
    position: "preceding",
    instructions: "Include 'Employee ID:' before the ID value",
  },
};

const ticket = [
  "Customer: John Smith",
  "Email: john.smith@example.com",
  "Phone: 555-867-5309",
  "SSN: 123-45-6789",
  "Card: 4111-1111-1111-1111",
  "Employee ID: AB123456",
  "Issue: Billing dispute on account #4521.",
  "Contact: support@company.com",
].join(" | ");

console.log("--- Original Ticket ---");
console.log(ticket);
console.log();

// Show each transformation action in isolation (without restore, so the
// raw transformed output is visible instead of numbered placeholders).
const showcaseRedactor = createRedactor({
  rules: {
    email: { action: "mask", preserve: { first: 2 } },
    phone: { action: "remove" },
    us_ssn: { action: "format-preserve" },
    payment_card: { action: "token-replace" },
  },
});

console.log("--- Transformation Actions (isolated, no restore) ---");
console.log(
  `  mask (email):         ${showcaseRedactor.redact("Email: john.smith@example.com")}`,
);
console.log(
  `  remove (phone):       ${JSON.stringify(showcaseRedactor.redact("Phone: 555-867-5309"))}`,
);
console.log(
  `  format-preserve (ssn): ${showcaseRedactor.redact("SSN: 123-45-6789")}`,
);
console.log(
  `  token-replace (card): ${showcaseRedactor.redact("Card: 4111-1111-1111-1111")}`,
);
console.log();

// Each entity type uses a different transformation action.
// Allowlist exempts support@company.com from redaction.
// Restore mode produces numbered placeholders and a restoration map.
const redactor = createRedactor({
  presets: ["pii"],
  rules: {
    email: { action: "mask", preserve: { first: 2 } },
    phone: { action: "remove" },
    us_ssn: { action: "format-preserve" },
    payment_card: { action: "token-replace" },
    person_name_lite: { action: "redact" },
    employee_id: { action: "redact" },
    postal_code: "off",
  },
  detectors: [employeeIdDetector],
  allowlist: ["support@company.com"],
  restore: true,
});

// Inspect: see what would be detected before transforming.
const inspectStart = performance.now();
const inspection = redactor.inspect(ticket);
const inspectMs = performance.now() - inspectStart;

console.log("--- Inspection (detections only, text unchanged) ---");

for (const group of inspection.groups) {
  for (const match of group.matches) {
    console.log(
      `  [${match.entityType}] "${match.value}" → "${group.replacement}"`,
    );
    console.log(`    reasons: ${match.reasons.join(", ")}`);
  }
}

console.log();

// Redact with restoration map.
const redactStart = performance.now();
const { text: redactedText, map: restorationMap } = redactor.redact(ticket);
const redactMs = performance.now() - redactStart;

console.log("--- Redacted Ticket ---");
console.log(redactedText);
console.log();

console.log("--- Restoration Map ---");
console.log(restorationMap);
console.log();

// Restore: reverse the redaction back to original.
const restoreStart = performance.now();
const restoredText = redactor.restore(redactedText, restorationMap);
const restoreMs = performance.now() - restoreStart;

console.log("--- Restored Ticket ---");
console.log(restoredText);
console.log();

console.log(`Round-trip ${restoredText === ticket ? "PASS ✓" : "FAIL ✗"}\n`);

console.log("--- Timings ---");
console.log(`  inspect:  ${inspectMs.toFixed(2)}ms`);
console.log(`  redact:   ${redactMs.toFixed(2)}ms`);
console.log(`  restore:  ${restoreMs.toFixed(2)}ms`);

// Error handling: input limit exceeded.
console.log("--- Error Handling: Input Limit ---");

try {
  redactor.redact("x".repeat(MAX_INPUT_LENGTH + 1));
} catch (error) {
  if (error instanceof SensoredError) {
    const problem = error.toProblemDetails();
    console.log(`  SensoredError: ${error.code}`);
    console.log(`  Problem Details: ${JSON.stringify(problem, null, 4)}`);
  }
}
