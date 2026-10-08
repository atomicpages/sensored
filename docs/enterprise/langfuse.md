# LangFuse Integration

LangFuse is an observability platform for LLM applications. Sensored provides a
mask function adapter that redacts PII before data is sent to LangFuse.

## How it works

LangFuse accepts a `mask` function that transforms input before it is
stored. The `createLangfuseMaskFunction` adapter wraps a sensored redactor and
returns a function compatible with LangFuse's `mask` option.

```ts
import { createLangfuseMaskFunction } from "@sensored/enterprise/langfuse/mask";

const mask = createLangfuseMaskFunction({
  rules: {
    email: { action: "redact" },
    phone: { action: "redact" },
    ssn: { action: "redact" },
  },
});

// Pass to LangFuse client
const langfuse = new Langfuse({
  publicKey: "...",
  secretKey: "...",
  mask,
});
```

All PII detected by sensored's detectors will be redacted before LangFuse
stores the data. The redactor is created once and reused across all calls.

## Supported detectors

Any sensored detector works with the mask function — built-in presets, custom
detectors, and semantic confirmation:

```ts
const mask = createLangfuseMaskFunction({
  presets: ["pii"],
  rules: {
    email: { action: "redact" },
    phone: { action: "redact" },
    credit_card: { action: "mask" },
    ssn: { action: "redact" },
  },
});
```

## Example

```ts
import { createLangfuseMaskFunction } from "@sensored/enterprise/langfuse/mask";
import { Langfuse } from "langfuse";

const mask = createLangfuseMaskFunction({
  rules: {
    email: { action: "redact" },
    phone: { action: "redact" },
  },
});

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  mask,
});

const trace = langfuse.trace({
  name: "user-chat",
  input: "My email is alice@example.com, call me at 555-123-4567",
});
// LangFuse stores: "My email is [EMAIL], call me at [PHONE]"
```
