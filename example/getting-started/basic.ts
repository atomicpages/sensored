/**
 * Basic example: stream an OpenAI completion through sensored's
 * streaming redactor in real-time, redacting PII as it arrives.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... bun run basic.ts
 */

import OpenAI from "openai";
import { createRedactor, type RestorationMap } from "sensored";
import { env } from "../shared/env";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Create a redactor with PII preset and restoration map support.
const redactor = createRedactor({
  presets: ["pii"],
  rules: {},
  restore: true,
});

// Prompt that's likely to produce PII in the response.
const prompt =
  "Write a short customer support email to John Smith confirming his " +
  "appointment next Tuesday. Include his email john.smith@example.com and " +
  "phone 555-867-5309 in the email body.";

console.log("Sending prompt to OpenAI...\n");

const streamStart = performance.now();

const completion = await openai.chat.completions.create({
  model: env.OPENAI_MODEL,
  messages: [{ role: "user", content: prompt }],
  stream: true,
});

// Convert the OpenAI streaming response into an AsyncIterable<string>.
async function* textChunks(): AsyncIterable<string> {
  for await (const part of completion) {
    const delta = part.choices[0]?.delta?.content;

    if (delta) {
      yield delta;
    }
  }
}

// Stream the completion through sensored's redactor.
let restorationMap: RestorationMap | undefined;

for await (const event of redactor.stream(textChunks(), { restore: true })) {
  if (event.type === "text") {
    process.stdout.write(event.text);
  } else if (event.type === "detection") {
    console.error(`\n[redacted: ${event.group.replacement}]`);
  } else if (event.type === "complete") {
    restorationMap = event.map;
  }
}

const elapsed = performance.now() - streamStart;

console.log("\n");
console.log(`Streaming redaction completed in ${elapsed.toFixed(0)}ms\n`);

if (restorationMap && Object.keys(restorationMap).length > 0) {
  console.log("--- Restoration Map ---");
  console.log(restorationMap);
} else {
  console.log("No PII detected in the response.");
}
