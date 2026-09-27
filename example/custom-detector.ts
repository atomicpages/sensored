/**
 * Custom detector example: demonstrates the full DetectorDefinition
 * extension contract in isolation.
 *
 * No API keys required.
 *
 * Usage:
 *   bun run custom-detector.ts
 */

import { createRedactor, type DetectorDefinition } from "sensored";

// A custom detector for employee IDs.
// This demonstrates every field of the DetectorDefinition contract.
const employeeIdDetector: DetectorDefinition = {
  id: "employee_id",
  entityType: "employee_id",
  replacement: "[EMPLOYEE_ID]",

  // Regex pattern to match candidate strings.
  pattern: /(?<![\p{L}\p{M}\p{N}_])[A-Z]{2}\d{6}(?![\p{L}\p{M}\p{N}_])/u,

  // Context window: look 20 chars before and 0 chars after the match
  // for the required context label.
  context: { before: 20, after: 0 },

  // Stream metadata: allows this detector to work in streaming mode.
  stream: {
    maxMatchLength: 8,
    leftContext: 20,
    rightContext: 0,
    boundaryLookaround: 1,
  },

  // Validate: return reasons array if the match is valid, false otherwise.
  // Here we require "Employee ID" to appear in the preceding context.
  validate({ before }) {
    return /Employee ID/i.test(before) ? ["employee_id.context"] : false;
  },

  // Context hint: metadata for LLM steering. Tells the LLM to include
  // "Employee ID:" before the value so the detector can find it.
  contextHint: {
    labels: ["Employee ID"],
    position: "preceding",
    instructions: "Include 'Employee ID:' before the ID value",
  },
};

// Register the custom detector alongside built-in detectors.
const redactor = createRedactor({
  presets: ["pii"],
  rules: {
    person_name_lite: { action: "redact" },
    email: { action: "redact" },
    employee_id: { action: "redact" },
    postal_code: "off",
  },
  detectors: [employeeIdDetector],
  restore: true,
});

const input =
  "Employee ID: AB123456 | Contact: John Smith | Email: john.smith@example.com";

console.log("--- Input ---");
console.log(input);
console.log();

// Inspect: see what the custom detector finds.
const inspectStart = performance.now();
const inspection = redactor.inspect(input);
const inspectMs = performance.now() - inspectStart;

console.log("--- Inspection ---");

for (const group of inspection.groups) {
  for (const match of group.matches) {
    console.log(
      `  [${match.entityType}] "${match.value}" → "${group.replacement}"`,
    );
    console.log(`    reasons: ${match.reasons.join(", ")}`);
  }
}

console.log();

// Redact with restoration.
const redactStart = performance.now();
const { text: redacted, map: restorationMap } = redactor.redact(input);
const redactMs = performance.now() - redactStart;

console.log("--- Redacted ---");
console.log(redacted);
console.log();

console.log("--- Restoration Map ---");
console.log(restorationMap);
console.log();

// Restore: reverse the redaction.
const restoreStart = performance.now();
const restored = redactor.restore(redacted, restorationMap);
const restoreMs = performance.now() - restoreStart;

console.log("--- Restored ---");
console.log(restored);
console.log();

console.log(`Round-trip ${restored === input ? "PASS ✓" : "FAIL ✗"}`);

console.log(`\n--- Timings ---`);
console.log(`  inspect: ${inspectMs.toFixed(2)}ms`);
console.log(`  redact:  ${redactMs.toFixed(2)}ms`);
console.log(`  restore: ${restoreMs.toFixed(2)}ms`);
