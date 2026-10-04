# Restoration

Restoration mode enables reversible redaction. When enabled, redacted text uses
numbered placeholders and a restoration map records the original values.

## Enabling restoration

```ts
const redactor = createRedactor({
  presets: ["pii"],
  rules: {},
  restore: true,
});

const { text, map } = redactor.redact(
  "Email: john@example.com, Phone: 555-123-4567",
);
// text: "Email: [EMAIL_1], Phone: [PHONE_1]"
// map: {
//   "[EMAIL_1]": "john@example.com",
//   "[PHONE_1]": "555-123-4567"
// }
```

## Restoring text

Use `redactor.restore()` or the standalone `restore()` function to reverse
redaction:

```ts
const restored = redactor.restore(text, map);
// "Email: john@example.com, Phone: 555-123-4567"
```

```ts
import { restore } from "sensored";

const restored = restore(text, map);
```

## Numbered placeholders

Without restoration, all matches of the same type share a label: `[EMAIL]`,
`[PHONE]`. With restoration, each match gets a unique numbered placeholder:
`[EMAIL_1]`, `[EMAIL_2]`, `[PHONE_1]`.

This ensures the restoration map has unambiguous keys.

## RestorationMap

```ts
type RestorationMap = Readonly<Record<string, string>>;
```

A plain object mapping placeholder strings to their original values. You can
serialize it to JSON for storage or transmission:

```ts
const { text, map } = redactor.redact(input);

// Store or transmit
const json = JSON.stringify(map);

// Later
const restoredMap = JSON.parse(json) as RestorationMap;
const restored = redactor.restore(text, restoredMap);
```

## Streaming with restoration

Restoration works in streaming mode too. Enable it via `StreamOptions`:

```ts
const redactor = createRedactor({ presets: ["pii"], rules: {} });

const stream = redactor.stream(asyncChunks(), { restore: true });

for await (const event of stream) {
  if (event.type === "text") {
    process.stdout.write(event.text);
  }
  if (event.type === "complete") {
    console.log(event.map);
    // { "[EMAIL_1]": "john@example.com" }
  }
}
```

## Idempotency

Restoration is idempotent. Calling `restore()` on already-restored text is safe
— the placeholder pattern only matches `[UPPERCASE_N]` formats, so original text
won't be accidentally modified.

Redaction is also idempotent: re-redacting already-redacted text is a no-op
because the library detects existing placeholders and skips detection within
those spans.

## Session API

For multi-turn conversations (e.g. LLM chat), `createSession` provides a
stateful redactor that persists the placeholder map across calls. The same
PII value always maps to the same placeholder, even across different turns.

```ts
import { createSession } from "sensored/session";

const session = createSession({
  rules: { email: { action: "redact" }, phone: { action: "redact" } },
});

// Turn 1
session.redact("email john@example.com");   // "email [EMAIL_1]"

// Turn 2 — same value, same placeholder
session.redact("also email john@example.com"); // "also email [EMAIL_1]"

// Restore at any time
session.restore("contact [EMAIL_1]");       // "contact john@example.com"

// Access the accumulated map
session.map; // { "[EMAIL_1]": "john@example.com" }

// Reset for a new conversation
session.reset();
```

### Hydration

Pass an existing `RestorationMap` to resume a session:

```ts
const session = createSession(config, existingMap);
// Counters resume from the highest existing number per entity type.
// Malformed keys are skipped silently.
```

### Using sessions with LLM adapters

`wrapOpenAI` and `wrapAnthropic` accept a `Session` directly:

```ts
import { wrapOpenAI } from "sensored/adapters/openai";
import { createSession } from "sensored/session";

const session = createSession({ presets: ["pii"] });
const client = wrapOpenAI(new OpenAI({ apiKey }), session);
```

When a session is passed, the adapter uses `session.redact()` for prompts and
`session.map` for response restoration. `detectOnly` is always false.
