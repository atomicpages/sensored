# Flag Mode

Flag mode lets you run all detectors **without modifying text**. This is useful
for auditing what PII would be detected before you enable redaction in
production.

## Enabling flag mode

Set `detectOnly: true` in your `RedactorConfig`:

```ts
import { createRedactor } from "sensored";

const redactor = createRedactor({
  presets: ["pii"],
  rules: {},
  detectOnly: true,
});
```

When `detectOnly` is `true`:

- `redact()` returns the original text unmodified
- `inspect()` returns the original text plus detection groups
- `stream()` emits original text with detection events
- `redactAsync()` returns original text with detections (no semantic
  confirmation needed since text isn't modified)
- No restoration map is generated

## Using inspect() to see what would be redacted

`inspect()` is the primary tool for flag mode. It returns the original text
and an array of detection groups — each with start/end offsets, the matched
value, and the rule that triggered:

```ts
const text = "Contact alice@example.com or call 555-867-5309";

const result = redactor.inspect(text);
console.log(result.text);
// "Contact alice@example.com or call 555-867-5309"

for (const group of result.groups) {
  console.log(
    group.start,
    group.end,
    group.replacement,
    group.matches.map((m) => m.ruleId),
  );
}
// 8 26 "alice@example.com" ["email"]
// 35 47 "555-867-5309"     ["phone"]
```

The `replacement` field contains the original text slice (not a placeholder),
so you can log or review exactly what was found.

## Streaming with flag mode

Flag mode works with streaming. Text events contain the original unmodified
text; detection events are still emitted when `report: true` is set:

```ts
async function* chunks() {
  yield "Contact alice@";
  yield "example.com for details.";
}

for await (const event of redactor.stream(chunks(), { report: true })) {
  if (event.type === "text") {
    process.stdout.write(event.text);
  }
  if (event.type === "detection") {
    console.log("Found:", event.group.replacement);
  }
}
// Output: Contact alice@example.com for details.
// Found: alice@example.com
```

## The "flag before redact" rollout pattern

A common production rollout strategy:

1. **Flag mode** — Deploy with `detectOnly: true`. Log detection counts and
   types. No text is modified, so there's zero risk to existing behavior.
2. **Review** — Analyze detection rates. Investigate false positives. Tune
   rules and allowlists.
3. **Redact mode** — Remove `detectOnly` (or set it to `false`). Redaction
   begins, replacing detected PII with placeholders.

```ts
// Phase 1: Flag
const flagger = createRedactor({
  presets: ["pii"],
  rules: {},
  detectOnly: true,
});

const result = flagger.inspect(logLine);
console.log(`Detected ${result.groups.length} PII items`);

// Phase 2: Redact
const redactor = createRedactor({
  presets: ["pii"],
  rules: {},
});
const safe = redactor.redact(logLine);
```

## Logging detection counts

In flag mode, you can log detection counts and types for validation without
touching the original text:

```ts
const flagger = createRedactor({
  presets: ["pii"],
  rules: {},
  detectOnly: true,
});

function scanForPII(text: string) {
  const result = flagger.inspect(text);
  const counts: Record<string, number> = {};

  for (const group of result.groups) {
    for (const match of group.matches) {
      counts[match.ruleId] = (counts[match.ruleId] ?? 0) + 1;
    }
  }

  return { total: result.groups.length, byType: counts };
}

console.log(scanForPII("Email alice@example.com, phone 555-123-4567"));
// { total: 2, byType: { email: 1, phone: 1 } }
```

## False positive review workflow

Use flag mode with an allowlist to iteratively reduce false positives:

```ts
const flagger = createRedactor({
  presets: ["pii"],
  rules: {},
  detectOnly: true,
  allowlist: [
    "noreply@company.com",
    "support@company.com",
  ],
});

const result = flagger.inspect(text);
for (const group of result.groups) {
  // Review each detection — if it's a false positive, add the
  // value to the allowlist and redeploy
}
```

## Flag mode with LLM adapters

The OpenAI and Anthropic adapters respect `detectOnly`. When enabled, prompts
are sent unmodified but detections are available for logging:

```ts
import { wrapOpenAI } from "sensored/adapters/openai";

const client = wrapOpenAI(new OpenAI(), {
  presets: ["pii"],
  rules: {},
  detectOnly: true,
});

// Messages are sent as-is; detections are logged but text isn't modified
```

## Constraints

- `detectOnly: true` combined with `restore: true` throws `INVALID_CONFIG`.
  Restoration requires redacted text to produce placeholders.
- `detectOnly` defaults to `false`. Omitting it or setting it to `undefined`
  behaves identically to `false`.
- Flag mode still runs all detectors, so the performance cost is the same as
  redaction mode. The savings come from skipping rendering and restoration.
