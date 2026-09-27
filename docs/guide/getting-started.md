# Installation

## Prerequisites

- **TypeScript** 7+ (peer dependency)
- **Bun** (recommended runtime and package manager)

## Install

```bash
bun add sensored
```

## Optional: NER-based person name detection

For higher-recall person name detection using Named Entity Recognition, install
the optional peer dependency:

```bash
bun add compromise
```

The default `person_name_lite` detector uses a lightweight regex + bloom filter
approach with no runtime dependencies. Use `person_name` in your rules to
opt in to compromise.js NER.

::: tip
The `person_name` detector adds ~178 MiB RSS and significantly reduces
throughput. Only use it when you need maximum recall for person names and can
accept the performance trade-off.
:::

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
