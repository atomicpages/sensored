# LLM Steering

Many sensored detectors are **context-dependent**: they only redact a candidate
when nearby text contains a confirming label. For example, `us_ssn` requires
"SSN" or "Social Security Number" nearby; `passport` requires "Passport" or
"Passport No."

This is great for precision but creates a problem for LLM-generated text: if the
model doesn't know which labels a detector expects, it may write the sensitive
value without a label, and the detector will silently skip it.

sensored solves this with two APIs that expose context requirements
programmatically so you can steer the model before it writes.

## listDetectors()

Returns descriptions of all 129 built-in detectors, including their context
hints (if any).

```ts
import { listDetectors } from "sensored";

const detectors = listDetectors();

for (const d of detectors) {
  if (d.contextHint) {
    console.log(`${d.id} requires labels: ${d.contextHint.labels.join(", ")}`);
  }
}
```

## redactor.describe()

Returns descriptions of only the detectors active in a given redactor's
resolved policy. Useful when you've already configured a redactor and want to
steer an LLM based on the active rules.

```ts
import { createRedactor } from "sensored";

const redactor = createRedactor({
  presets: ["pii"],
  rules: {},
});

const active = redactor.describe();

for (const d of active) {
  if (d.contextHint) {
    console.log(`${d.id}: ${d.contextHint.labels.join(", ")}`);
  }
}
```

## ContextHint shape

```ts
interface ContextHint {
  readonly required: boolean;
  readonly labels: readonly string[];
  readonly position: "preceding" | "following" | "both";
  readonly window: { readonly before: number; readonly after: number };
  readonly instructions?: string;
}
```

- **required** — Always `true` for context-dependent detectors.
- **labels** — Human-readable label strings the detector looks for (e.g.
  `["SSN", "Social Security Number"]`).
- **position** — Where labels must appear relative to the candidate: `preceding`,
  `following`, or `both`.
- **window** — Character window size the detector searches within.
- **instructions** — Optional free-text steering guidance for detectors with
  non-standard context rules. When present, prefer these instructions over the
  labels array.

## Steering pattern

A typical steering workflow:

1. Build your redactor with the desired presets/rules.
2. Call `redactor.describe()` to get active detector descriptions.
3. Filter for detectors that have a `contextHint`.
4. Inject the label requirements into your LLM system prompt.

```ts
import { createRedactor } from "sensored";

const redactor = createRedactor({
  presets: ["pii"],
  rules: {},
});

const hints = redactor
  .describe()
  .filter((d) => d.contextHint)
  .map((d) => ({
    id: d.id,
    labels: d.contextHint!.labels,
    position: d.contextHint!.position,
    instructions: d.contextHint!.instructions,
  }));

const systemPrompt = `You are a helpful assistant. When writing sensitive data,
include one of these labels nearby so the redaction engine can detect it:

${JSON.stringify(hints, null, 2)}`;
```

## Custom detectors

Custom detectors can declare a `contextHint` in their `DetectorDefinition`.
See [Custom Detectors](./custom-detectors#contexthint) for details.
