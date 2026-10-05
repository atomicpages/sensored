/**
 * OpenAI wrapper example: wrap an OpenAI client with sensored so that
 * prompts are automatically redacted and responses are automatically
 * restored. Compare with basic.ts which uses the streaming redactor
 * manually.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... bun run openai-wrapper.ts
 */

import OpenAI from "openai";
import { wrapOpenAI } from "sensored/providers/openai";
import { env } from "../shared/env";

const client = wrapOpenAI(new OpenAI({ apiKey: env.OPENAI_API_KEY }), {
  presets: ["pii"],
  rules: {
    person_name_lite: { action: "redact" },
    email: { action: "redact" },
    phone: { action: "redact" },
  },
});

const prompt =
  "Write a short customer support email to John Smith confirming his " +
  "appointment next Tuesday. Include his email john.smith@example.com and " +
  "phone 555-867-5309 in the email body.";

console.log("--- Non-streaming response ---\n");

const response = await client.chat.completions.create({
  model: env.OPENAI_MODEL,
  messages: [{ role: "user", content: prompt }],
});

console.log(response.choices[0]?.message?.content);

console.log("\n--- Streaming response ---\n");

const stream = await client.chat.completions.create({
  model: env.OPENAI_MODEL,
  messages: [{ role: "user", content: prompt }],
  stream: true,
});

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content;
  if (delta) {
    process.stdout.write(delta);
  }
}

console.log("\n");
