/**
 * NER redaction example: uses the compromise-powered person_name detector
 * (NER) instead of the lightweight person_name_lite (bloom filter).
 *
 * The person_name detector is opt-in — it is not included in any preset.
 * It provides higher accuracy (fewer false positives like "Vital Signs" or
 * "Complete Blood Count") at the cost of much lower throughput.
 *
 * Requires the `compromise` package (installed at the repo root).
 *
 * No API keys required.
 *
 * Usage:
 *   bun run ner-redaction.ts
 */

import { createRedactor } from "sensored";

const SHARED = `${import.meta.dir}/../shared`;
const INPUT_PATH = `${SHARED}/sample-clinical-note.txt`;
const OUTPUT_PATH = `${SHARED}/redacted-clinical-note-ner.txt`;

const original = await Bun.file(INPUT_PATH).text();

// Redactor with NER-based person_name (opt-in, not in any preset).
const nerRedactor = createRedactor({
  presets: ["hipaa"],
  rules: {
    person_name: { action: "redact" },
    person_name_lite: "off",
    email: { action: "redact" },
    phone: { action: "redact" },
    us_ssn: { action: "format-preserve" },
    postal_code: "off",
  },
  restore: true,
});

// Redactor with bloom-filter person_name_lite for comparison.
const liteRedactor = createRedactor({
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

console.log(`Reading ${INPUT_PATH} (${original.length} chars)\n`);

// Inspect both redactors on the same document.
const nerInspectStart = performance.now();
const nerInspection = nerRedactor.inspect(original);
const nerInspectMs = performance.now() - nerInspectStart;

const liteInspectStart = performance.now();
const liteInspection = liteRedactor.inspect(original);
const liteInspectMs = performance.now() - liteInspectStart;

const nerNames = nerInspection.groups.filter((g) =>
  g.matches.some((m) => m.entityType === "person_name"),
);

const liteNames = liteInspection.groups.filter((g) =>
  g.matches.some((m) => m.entityType === "person_name_lite"),
);

console.log("--- person_name (NER) detections ---");

for (const group of nerNames) {
  for (const match of group.matches) {
    console.log(`  "${match.value}" → "${group.replacement}"`);
  }
}

console.log(`\nTotal NER detections: ${nerNames.length}\n`);

console.log("--- person_name_lite (bloom filter) detections ---");

for (const group of liteNames) {
  for (const match of group.matches) {
    console.log(`  "${match.value}" → "${group.replacement}"`);
  }
}

console.log(`\nTotal bloom filter detections: ${liteNames.length}\n`);

// Show false positives that NER eliminates.
const nerValues = new Set(
  nerNames.flatMap((g) => g.matches.map((m) => m.value)),
);

const liteFalsePositives = liteNames
  .flatMap((g) => g.matches.map((m) => m.value))
  .filter((v) => !nerValues.has(v));

console.log("--- False positives eliminated by NER ---");

for (const value of liteFalsePositives) {
  console.log(`  "${value}"`);
}

console.log(
  `\nTotal false positives eliminated: ${liteFalsePositives.length}\n`,
);

// Redact with NER and write the de-identified output.
const nerRedactStart = performance.now();
const { text: redacted, map: restorationMap } = nerRedactor.redact(original);
const nerRedactMs = performance.now() - nerRedactStart;

await Bun.write(OUTPUT_PATH, redacted);

console.log(
  `Redacted output written to ${OUTPUT_PATH} (${redacted.length} chars)\n`,
);

// Verify round-trip.
const restoreStart = performance.now();
const restored = nerRedactor.restore(redacted, restorationMap);
const restoreMs = performance.now() - restoreStart;

console.log(`Round-trip ${restored === original ? "PASS ✓" : "FAIL ✗"}`);

console.log(`\n--- Timings ---`);
console.log(`  NER inspect:           ${nerInspectMs.toFixed(2)}ms`);
console.log(`  bloom filter inspect:  ${liteInspectMs.toFixed(2)}ms`);
console.log(`  NER redact:            ${nerRedactMs.toFixed(2)}ms`);
console.log(`  restore:               ${restoreMs.toFixed(2)}ms`);
