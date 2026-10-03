# LLM Prompt Redaction

When sending prompts to LLM providers like OpenAI or Anthropic, sensitive user
data in the prompt is transmitted to a third-party API. sensored provides
wrapper adapters that automatically redact PII from prompts before they leave
your process and restore placeholders in the responses.

## How it works

1. **Redact**: PII in the prompt is replaced with numbered placeholders (e.g.
   `john@example.com` → `[EMAIL_1]`)
2. **Send**: The redacted prompt is sent to the LLM API
3. **Restore**: Placeholders in the response are restored to original values
   before returning to your code

The restoration map is held in memory for the duration of the API call. The same
PII value gets the same placeholder within one call, so the LLM sees consistent
references.

## OpenAI

Wraps an OpenAI client, redacting the `messages` array and restoring responses.

### Install

```bash
bun add openai
```

### Usage

```ts
import OpenAI from "openai";
import { wrapOpenAI } from "sensored/providers/openai";

const client = wrapOpenAI(new OpenAI(), {
  presets: ["pii"],
  rules: {
    person_name_lite: { action: "redact" },
    email: { action: "redact" },
    phone: { action: "redact" },
  },
});

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "user",
      content: "Send an email to john@example.com about their order.",
    },
  ],
});
// Model receives: "Send an email to [EMAIL_1] about their order."
// Response is restored: placeholders become original values automatically.
console.log(response.choices[0]?.message?.content);
```

### Streaming

Streaming responses are handled automatically. Placeholders split across chunk
boundaries are reassembled correctly using `StreamRestorer`:

```ts
const stream = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "user", content: "Email john@example.com about order #123" },
  ],
  stream: true,
});

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content;
  if (delta) process.stdout.write(delta);
}
```

### Tool calls

Tool-call arguments are redacted and restored automatically:

```ts
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "user",
      content: "Call the send_email function for alice@example.com",
    },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "send_email",
        parameters: {
          type: "object",
          properties: { to: { type: "string" } },
        },
      },
    },
  ],
});
// Tool call arguments are restored in the response.
```

## Anthropic

Wraps an Anthropic client, redacting the `messages` array and `system` prompt,
and restoring responses.

### Install

```bash
bun add @anthropic-ai/sdk
```

### Usage

```ts
import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropic } from "sensored/providers/anthropic";

const client = wrapAnthropic(new Anthropic(), {
  presets: ["pii"],
  rules: {
    person_name_lite: { action: "redact" },
    email: { action: "redact" },
    phone: { action: "redact" },
  },
});

const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  system: "You are a helpful assistant for alice@corp.com",
  messages: [{ role: "user", content: "Send the invoice to bob@example.com" }],
});
// Model receives redacted system + messages; response is restored.
for (const block of response.content) {
  if (block.type === "text") console.log(block.text);
}
```

### What gets redacted

The Anthropic adapter redacts only the `messages` and `system` fields. Other
parameters (`model`, `max_tokens`, `temperature`, `top_p`, `stop_sequences`,
etc.) pass through unmodified.

### Streaming

Streaming responses are handled automatically, including `text_delta` and
`partial_json` events:

```ts
const stream = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Email alice@example.com" }],
  stream: true,
});

for await (const event of stream) {
  if (event.type === "content_block_delta") {
    const delta = event.delta;
    if (delta.type === "text_delta") {
      process.stdout.write(delta.text);
    }
  }
}
```

### System prompt as text blocks

The adapter handles both string and array (text block) system prompts:

```ts
const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  system: [{ type: "text", text: "Instructions for bob@example.com" }],
  messages: [{ role: "user", content: "Hello" }],
});
```

## One-off redaction

For cases where you don't need a client wrapper, use `redactPrompt`:

```ts
import { redactPrompt } from "sensored/providers/openai";

const { text, map } = redactPrompt(
  "Contact john@example.com about order #123",
  { presets: ["pii"], rules: {} },
);
// text: "Contact [EMAIL_1] about order #123"
// map: { "[EMAIL_1]": "john@example.com" }
```

## detectOnly mode

Use `detectOnly: true` to send prompts unmodified while still detecting PII.
Useful for auditing what would be redacted before enabling it in production:

```ts
const client = wrapOpenAI(new OpenAI(), {
  presets: ["pii"],
  rules: { email: { action: "redact" } },
  detectOnly: true,
});
// Prompts are sent as-is; no redaction or restoration occurs.
```

## Idempotent wrapping

Wrapping an already-wrapped client is a no-op. The wrapper uses a Symbol to
detect double-wrapping and returns the same client:

```ts
const wrapped = wrapOpenAI(client, config);
const doubleWrapped = wrapOpenAI(wrapped, config);
// doubleWrapped === wrapped
```

## Security considerations

- The restoration map contains plaintext PII mappings. Treat it as sensitive —
  do not log it or serialize it to unencrypted storage.
- The map persists in memory until garbage-collected. JavaScript strings are
  immutable and cannot be securely zeroed.
- Redaction happens before the API call; restoration happens after the response.
  PII never appears in the request payload sent to the LLM provider.
