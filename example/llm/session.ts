/**
 * Session example: persistent redaction across a multi-turn LLM conversation
 * with dedup, streaming, hydration, and reset — using a real OpenAI model.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... bun run session.ts
 */

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources";
import { wrapOpenAI } from "../../src/adapters/openai";
import { createSession } from "../../src/session";
import { env } from "../shared/env";

const SYSTEM_PROMPT = [
  "You are a concise customer support assistant.",
  "Keep responses under 3 sentences.",
  "Never modify or reformat placeholders like [EMAIL_1] or [PHONE_1].",
  "Always echo them back exactly as given.",
].join(" ");

const session = createSession({
  presets: ["pii"],
  rules: {
    person_name_lite: { action: "redact" },
    email: { action: "redact" },
    phone: { action: "redact" },
  },
});

const client = wrapOpenAI(new OpenAI({ apiKey: env.OPENAI_API_KEY }), session);

const messages: Array<ChatCompletionMessageParam> = [
  { role: "system", content: SYSTEM_PROMPT },
];

async function sendTurn(text: string): Promise<string> {
  messages.push({ role: "user", content: text });

  console.log("User:", text);
  console.log("Assistant:");

  const stream = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages,
    stream: true,
  });

  let full = "";

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      full += delta;
      process.stdout.write(delta);
    }
  }

  console.log("\n");
  messages.push({ role: "assistant", content: full });

  return full;
}

console.log("=== 1. Multi-turn conversation (streaming) ===\n");

await sendTurn("Hi, I'm John Smith. I need help with my account.");
await sendTurn("My email is john@example.com and my phone is 555-867-5309.");
await sendTurn("Can you confirm john@example.com is on file? Thanks!");

console.log("=== 2. Session map (dedup evidence) ===\n");

console.log("Restoration map:", session.map);

console.log("\n=== 3. Hydration from existing map ===\n");

const hydrated = createSession(
  {
    presets: ["pii"],
    rules: {
      person_name_lite: { action: "redact" },
      email: { action: "redact" },
      phone: { action: "redact" },
    },
  },
  session.map,
);

const hydratedClient = wrapOpenAI(
  new OpenAI({ apiKey: env.OPENAI_API_KEY }),
  hydrated,
);

const continuation = "Following up with John Smith at john@example.com.";

console.log("User:", continuation);
console.log("Assistant:");

const hydrateStream = await hydratedClient.chat.completions.create({
  model: env.OPENAI_MODEL,
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: continuation },
  ],
  stream: true,
});

for await (const chunk of hydrateStream) {
  const delta = chunk.choices[0]?.delta?.content;
  if (delta) {
    process.stdout.write(delta);
  }
}

console.log("\n");
console.log("Hydrated map:", hydrated.map);

console.log("\n=== 4. Reset ===\n");

session.reset();

console.log("Map keys after reset:", Object.keys(session.map).length);

const freshTurn = "Hi, I'm Jane Doe. Email me at jane@example.com.";

console.log("User:", freshTurn);
console.log("Assistant:");

const freshStream = await client.chat.completions.create({
  model: env.OPENAI_MODEL,
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: freshTurn },
  ],
  stream: true,
});

for await (const chunk of freshStream) {
  const delta = chunk.choices[0]?.delta?.content;
  if (delta) {
    process.stdout.write(delta);
  }
}

console.log("\n");
console.log("Fresh map:", session.map);
