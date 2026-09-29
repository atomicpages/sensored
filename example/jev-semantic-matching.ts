/**
 * Phase 2: LLM steering and AI-powered semantic confirmation.
 *
 * Requires OPENAI_API_KEY and TYPESAFE_API_KEY.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... TYPESAFE_API_KEY=... bun run jev-semantic-matching.ts
 */

import OpenAI from "openai";
import { createRedactor, SensoredError } from "sensored";
import { env } from "./env";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Redactor with semantic confirmation via Jev.
// person_name_lite gets a stricter threshold (0.7) than the default (0.5).
const redactor = createRedactor({
  rules: {
    person_name_lite: { action: "redact" },
    email: { action: "redact" },
    phone: { action: "redact" },
  },
  restore: true,
  semantic: {
    provider: "jev",
    apiKey: env.TYPESAFE_API_KEY,
    thresholds: {
      person_name_lite: 0.7,
      default: 0.5,
    },
  },
});

// Extract context hints from active detectors to steer the LLM.
const hints = redactor
  .describe()
  .filter((d) => d.contextHint)
  .map((d) => ({
    id: d.id,
    labels: d.contextHint!.labels,
    position: d.contextHint!.position,
    instructions: d.contextHint!.instructions,
  }));

console.log("--- Context Hints (for LLM steering) ---");
console.log(JSON.stringify(hints, null, 2));
console.log();

// Build a system prompt that steers the LLM to include context labels
// near sensitive data, so context-required detectors can find it.
const systemPrompt = [
  "You are a customer support assistant. Write a concise case summary",
  "based on the provided ticket. When mentioning sensitive data, include",
  "a context label nearby so the redaction engine can detect it:",
  "",
  JSON.stringify(hints, null, 2),
].join("\n");

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

console.log("Sending ticket to OpenAI for case summary...\n");

try {
  const completion = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Write a case summary for this ticket:\n\n${ticket}`,
      },
    ],
  });

  const aiResponse = completion.choices[0]?.message?.content ?? "";

  console.log("--- AI Case Summary (raw) ---");
  console.log(aiResponse);
  console.log();

  // Sync redact: no semantic filtering (all regex matches are redacted).
  const syncStart = performance.now();
  const syncResult = redactor.redact(aiResponse);
  const syncMs = performance.now() - syncStart;

  // Async redact: semantic confirmation via Jev (false positives dropped).
  const asyncStart = performance.now();
  const asyncResult = await redactor.redactAsync(aiResponse);
  const asyncMs = performance.now() - asyncStart;

  console.log("--- Sync Redaction (no semantic confirmation) ---");
  console.log(syncResult);
  console.log();

  console.log("--- Async Redaction (with Jev semantic confirmation) ---");
  console.log(asyncResult.text);
  console.log();

  console.log("--- Semantic Detections ---");

  for (const detection of asyncResult.detections) {
    console.log(
      `  [${detection.entityType}] confirmed=${detection.semanticConfirmed}` +
        (detection.noul !== undefined ? ` noul=${detection.noul}` : ""),
    );
  }

  console.log();

  if (asyncResult.warnings) {
    console.log("--- Warnings ---");

    for (const warning of asyncResult.warnings) {
      console.log(`  ${warning}`);
    }

    console.log();
  }

  // Compare: show which detections were dropped by semantic confirmation.
  const syncInspection = redactor.inspect(aiResponse);
  const syncEntityCount = syncInspection.groups.length;

  console.log("--- Comparison ---");
  console.log(`  Sync detections:   ${syncEntityCount}`);
  console.log(`  Async detections:  ${asyncResult.detections.length}`);

  if (syncEntityCount > asyncResult.detections.length) {
    console.log(
      `  Semantic confirmation eliminated ${syncEntityCount - asyncResult.detections.length} false positive(s)`,
    );
  }

  console.log();

  if (asyncResult.map) {
    console.log("--- Restoration Map ---");
    console.log(asyncResult.map);
    console.log();
  }

  console.log("--- Timings ---");
  console.log(`  sync redact:   ${syncMs.toFixed(0)}ms`);
  console.log(
    `  async redact:  ${asyncMs.toFixed(0)}ms (includes Jev API call)`,
  );
} catch (error) {
  if (error instanceof SensoredError) {
    console.error(`SensoredError: ${error.code}`);
    console.error(JSON.stringify(error.toProblemDetails(), null, 2));
  } else {
    console.error("Unexpected error:", error);
  }

  process.exit(1);
}
