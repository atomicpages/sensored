# Installation

## Prerequisites

- **TypeScript** 7+ (peer dependency)
- **Bun** (recommended runtime and package manager)

## Install

```bash
bun add sensored
```

## Person name detection

The default `person_name_lite` detector uses a lightweight regex + bloom filter.
Use `person_name` in your rules to opt in to the rule-based NER; it needs no
extra dependency.

## Optional: AI semantic confirmation

For AI-powered semantic confirmation that eliminates false positives, install
the optional peer dependency:

```bash
bun add @typesafe-ai/sdk
```

When configured, `redactAsync()` sends detected candidates to Jev for
verification before redacting. See [AI Confirmation](./semantic-confirmation)
for details.

## Verify your install

```ts
import { createRedactor } from "sensored";

const redactor = createRedactor({ presets: ["pii"], rules: {} });

const result = redactor.redact("Contact me at john@example.com.");
console.log(result);
// "Contact me at [EMAIL_1]."
```

If you see `[EMAIL_1]` in the output, you're up and running.
