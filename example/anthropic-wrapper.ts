/**
 * Anthropic wrapper example: wrap an Anthropic client with sensored so
 * that prompts are automatically redacted and responses are automatically
 * restored.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... bun run anthropic-wrapper.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropic } from "sensored/providers/anthropic";
import { env } from "./env";

const client = wrapAnthropic(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), {
  presets: ["pii"],
  rules: {
    person_name_lite: { action: "redact" },
    email: { action: "redact" },
    phone: { action: "redact" },
  },
});

const prompt =
  "Write a short customer support email to Jane Doe confirming her " +
  "appointment next Wednesday. Include her email jane.doe@example.com and " +
  "phone 555-123-4567 in the email body.";

console.log("--- Non-streaming response ---\n");

const response = await client.messages.create({
  model: env.ANTHROPIC_MODEL,
  max_tokens: 1024,
  messages: [{ role: "user", content: prompt }],
});

for (const block of response.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
}

console.log("\n--- Streaming response ---\n");

const stream = await client.messages.create({
  model: env.ANTHROPIC_MODEL,
  max_tokens: 1024,
  messages: [{ role: "user", content: prompt }],
  stream: true,
});

for await (const event of stream) {
  if (event.type === "content_block_delta") {
    const delta = event.delta;

    if (delta.type === "text_delta") {
      process.stdout.write(delta.text as string);
    }
  }
}

console.log("\n");
