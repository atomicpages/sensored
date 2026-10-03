# AI Confirmation

Semantic confirmation is an opt-in layer that uses AI (Jev from TypeSafe's
System One) to verify detected PII candidates before redacting them. It reduces
false positives by asking a semantic model "yes/no" questions about each
candidate. Detectors propose spans; Jev confirms or rejects each one; redaction
runs only after. Candidate `value` plus surrounding context are sent to Jev
**unredacted** — the input is still fully readable when confirmation runs.

## Overview

- Opt-in feature — no behavior change unless configured
- Only affects `redactAsync()` — sync `redact()` and `stream()` are unaffected
- Only detectors with a `semanticConfirm()` method participate
- Currently only `person_name_lite` is opted in
- Fails open: if the AI provider is unavailable, all detections are kept
- Precision filter on detector candidates — not a second scan for missed PII

## Privacy

Enabling `semantic` sends each opted-in candidate's raw match text and nearby
context to TypeSafe (Jev). Sync `redact()` and `stream()` never do this. Use
`redactAsync()` with `semantic` only when that data flow is acceptable for your
workload.

## Installation

The `@typesafe-ai/sdk` package is an optional peer dependency:

```bash
bun add @typesafe-ai/sdk
```

## Configuration

Add a `semantic` block to your `RedactorConfig`:

```ts
import { createRedactor } from "sensored";

const redactor = createRedactor({
  rules: { person_name_lite: { action: "redact" } },
  semantic: {
    provider: "jev",
    apiKey: process.env.TYPESAFE_API_KEY!,
  },
});

const result = await redactor.redactAsync("Contact John Smith today");
// result.text: "Contact [PERSON_NAME] today"
// result.detections[0].semanticConfirmed: true
// result.detections[0].noul: 0.95
```

### SemanticConfig

```ts
interface SemanticConfig {
  readonly provider: "jev";
  readonly apiKey: string;
  readonly model?: string;
  readonly thresholds?: Readonly<Record<string, number>>;
  readonly contextWindow?: number;
}
```

### Options

- **provider** — Must be `"jev"`. Only Jev is supported in v1.
- **apiKey** — Your TypeSafe API key.
- **model** — Jev model to use. Defaults to `"jev-latest"`.
- **thresholds** — Per-rule noul thresholds (0–1). Detections with noul below
  the threshold are dropped. Defaults to `0.5`. Use `"default"` as a catch-all
  key.
- **contextWindow** — Characters of unredacted context before and after each
  candidate `value` sent to Jev. Defaults to `200`. The match itself is always
  sent as raw text from the original input.

### Thresholds

```ts
semantic: {
  provider: "jev",
  apiKey: process.env.TYPESAFE_API_KEY!,
  thresholds: {
    person_name_lite: 0.7,  // stricter for person names
    default: 0.5,           // fallback for other detectors
  },
}
```

## redactAsync()

`redactAsync()` is the async variant of `redact()`. It runs sync detection
first, then sends opted-in candidates to Jev for confirmation, drops unconfirmed
detections as false positives, and renders the final text.

```ts
const result = await redactor.redactAsync(text);
```

Returns `AsyncRedactResult`:

```ts
interface AsyncRedactResult {
  readonly text: string;
  readonly map?: RestorationMap;
  readonly detections: readonly SemanticDetection[];
  readonly warnings?: readonly string[];
}
```

- **text** — The redacted text (same format as `redact()`).
- **map** — Present when `restore: true` is set in config.
- **detections** — Detections confirmed by Jev (or kept on fail-open). Each
  includes `semanticConfirmed: boolean` and optional `noul: number`. Unconfirmed
  candidates are dropped as false positives and do not appear here.
- **warnings** — Present when the AI provider fails. All detections are kept
  (fail open).

## How it works

1. Sync detection runs all active detectors (same as `redact()`)
2. Candidates from detectors with `semanticConfirm()` are collected — each
   payload is `{ value, before, after }` sliced from the **original** input
3. If no candidates, early exit with all detections confirmed
4. All candidates are batched into a single Jev call (still unredacted)
5. Detections with noul below threshold are dropped as false positives
6. Remaining detections are rendered (same as `redact()`)

```ts
// Input still fully readable when Jev runs:
// value: "John Smith"
// before / after: surrounding chars from the original string
// Redaction happens only after confirmation (step 6)
```

## What this is not

- Not a second pass over already-redacted text
- Not a way to find PII the detectors missed
- Jev does not invent new spans — only yes/no (noul) judgments on detector
  candidates

## Streaming

Streaming stays sync-only. If `semantic` config is present, `stream()` emits a
console warning and proceeds without semantic confirmation.

## Custom detectors

Custom detectors can opt in to semantic confirmation by providing a
`semanticConfirm` function:

```ts
const customDetector: DetectorDefinition = {
  id: "custom_entity",
  entityType: "custom_entity",
  replacement: "[CUSTOM_ENTITY]",
  pattern: /\b[A-Z]{3}\d{4}\b/g,
  semanticConfirm({ value, before, after }) {
    return {
      instructions: "Determine whether the candidate is a custom entity.",
      criteria: {
        true: "The candidate matches the expected format.",
        false: "The candidate is not a custom entity.",
      },
    };
  },
};
```

The `semanticConfirm` function receives `{ value, before, after }` (raw slices
from the original input) and returns a `SemanticQuestion` with `instructions`
and optional `criteria` (with `true` and `false` strings).

## Error handling

Semantic confirmation fails open. If the Jev API call fails (network error,
invalid API key, rate limit, etc.), all detections are kept and a warning string
is added to `warnings[]`. The redacted text is still returned.

```ts
const result = await redactor.redactAsync("Contact John Smith today");
if (result.warnings?.length) {
  console.warn("Semantic confirmation failed:", result.warnings);
  // All detections kept — text is still redacted
}
```
