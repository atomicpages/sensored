/**
 * De-identify a file: read a clinical document, strip PHI using the
 * HIPAA preset, and write the redacted output to a new file.
 *
 * No API keys required.
 *
 * Usage:
 *   bun run deidentify-file.ts
 */

import { createRedactor } from "sensored";

const INPUT_PATH = "sample-clinical-note.txt";
const OUTPUT_PATH = "redacted-clinical-note.txt";

const redactor = createRedactor({
  presets: ["hipaa"],
  rules: {
    person_name_lite: { action: "redact" },
    email: { action: "redact" },
    phone: { action: "redact" },
    us_ssn: { action: "format-preserve" },
    postal_code: "off",
  },
  restore: true,
});

const original = await Bun.file(INPUT_PATH).text();

console.log(`Reading ${INPUT_PATH} (${original.length} chars)\n`);

// Inspect: show what PHI was found before transforming.
const inspectStart = performance.now();
const inspection = redactor.inspect(original);
const inspectMs = performance.now() - inspectStart;

console.log("--- PHI Detected ---");

let count = 0;

for (const group of inspection.groups) {
  for (const match of group.matches) {
    console.log(
      `  [${match.entityType}] "${match.value}" → "${group.replacement}"`,
    );
    count++;
  }
}

console.log(`\nTotal detections: ${count}\n`);

// Redact: produce de-identified text with a restoration map.
const redactStart = performance.now();
const { text: redacted, map: restorationMap } = redactor.redact(original);
const redactMs = performance.now() - redactStart;

// Write the redacted document to a new file.
await Bun.write(OUTPUT_PATH, redacted);

console.log(
  `Redacted output written to ${OUTPUT_PATH} (${redacted.length} chars)\n`,
);

console.log("--- Restoration Map ---");
console.log(restorationMap);
console.log();

// Verify: restoring the redacted text reproduces the original.
const restoreStart = performance.now();
const restored = redactor.restore(redacted, restorationMap);
const restoreMs = performance.now() - restoreStart;

console.log(`Round-trip ${restored === original ? "PASS ✓" : "FAIL ✗"}`);

console.log(`\n--- Timings ---`);
console.log(`  inspect: ${inspectMs.toFixed(2)}ms`);
console.log(`  redact:  ${redactMs.toFixed(2)}ms`);
console.log(`  restore: ${restoreMs.toFixed(2)}ms`);
