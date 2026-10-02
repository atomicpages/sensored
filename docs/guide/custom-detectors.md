# Custom Detectors

sensored lets you register custom detectors alongside the 131 built-in ones.
Built-in and custom detectors share the same contract — there's no separate
"plugin" API.

## DetectorDefinition

```ts
interface DetectorDefinition {
  id: string;
  entityType: string;
  replacement: string;
  pattern: RegExp;
  context?: { before: number; after: number };
  stream?: {
    maxMatchLength: number;
    leftContext: number;
    rightContext: number;
    boundaryLookaround: number;
  };
  validate?: (candidate: {
    value: string;
    before: string;
    after: string;
  }) => false | readonly string[];
  contextHint?: {
    labels?: readonly string[];
    position?: "preceding" | "following" | "both";
    instructions?: string;
  };
  readonly semanticConfirm?: (candidate: {
    readonly value: string;
    readonly before: string;
    readonly after: string;
  }) => SemanticQuestion;
}
```

### id

A unique identifier for the detector. Must not collide with any built-in
detector ID or another custom detector's ID.

### entityType

The entity type label used in reports and restoration maps. For example,
`"email"` produces `[EMAIL_1]` placeholders.

### replacement

The default replacement string when the action is `redact`. Typically a
bracketed label like `[EMPLOYEE_ID]`.

### pattern

A regex pattern with the `g` flag for finding candidate matches. Use lookbehind
and lookahead to enforce word boundaries:

```ts
pattern: /(?<![\p{L}\p{M}\p{N}_])[A-Z]{2}\d{6}(?![\p{L}\p{M}\p{N}_])/u,
```

### context

Optional context window for validation. When provided, the `validate` function
receives the text before and after the match within these windows:

```ts
context: { before: 20, after: 0 }
```

### stream

Stream metadata that enables the detector to work with the streaming engine. All
four fields are required for streaming support:

- **maxMatchLength** — Maximum length of a single match
- **leftContext** — Characters of context needed before the match
- **rightContext** — Characters of context needed after the match
- **boundaryLookaround** — Additional lookaround for boundary safety

If `stream` is omitted, the detector cannot be used in streaming mode. Calling
`redactor.stream()` with such a detector throws `STREAM_UNSUPPORTED`.

### validate

Optional validation function. Returns `false` to reject a candidate, or an array
of reason strings to accept it. Reasons appear in inspection reports:

```ts
validate({ value, before, after }) {
  if (/Employee ID/.test(before)) {
    return ["employee_id.context"];
  }
  return false;
}
```

## Example

Here's a complete custom detector for employee IDs:

```ts
import { createRedactor, type DetectorDefinition } from "sensored";

const employeeId: DetectorDefinition = {
  id: "employee_id",
  entityType: "employee_id",
  replacement: "[EMPLOYEE_ID]",
  pattern: /(?<![\p{L}\p{M}\p{N}_])[A-Z]{2}\d{6}(?![\p{L}\p{M}\p{N}_])/u,
  context: { before: 20, after: 0 },
  stream: {
    maxMatchLength: 8,
    leftContext: 20,
    rightContext: 0,
    boundaryLookaround: 1,
  },
  validate({ before }) {
    if (/Employee ID[:\s]/.test(before)) {
      return ["employee_id.context"];
    }
    return false;
  },
};

const redactor = createRedactor({
  presets: ["pii"],
  rules: { employee_id: { action: "redact" } },
  detectors: [employeeId],
});

redactor.redact("Employee ID: AB123456");
// "Employee ID: [EMPLOYEE_ID]"
```

## Built-in example

sensored ships with an example detector you can import directly:

```ts
import { employeeIdExample } from "sensored";
```

This is the same `employeeIdExample` detector shown above. It's not in the
built-in registry — you must register it via `config.detectors`.

## Rules for custom detectors

Custom detectors are enabled via `config.rules`, just like built-in detectors:

```ts
createRedactor({
  presets: ["pii"],
  rules: {
    employee_id: { action: "redact" },
    // or any other action
    employee_id: { action: "mask", preserve: { first: 2 } },
  },
  detectors: [employeeId],
});
```

## ID collisions

Custom detector IDs must not collide with built-in IDs. If a collision is
detected at creation time, an `INVALID_CONFIG` error is thrown.

## contextHint

Optional metadata that describes the context labels your detector requires. When
provided, `listDetectors()` and `redactor.describe()` will include it so LLM
steering pipelines can discover the requirement.

```ts
interface DetectorDefinition {
  // ... other fields ...

  readonly contextHint?: {
    readonly labels?: readonly string[];
    readonly position?: "preceding" | "following" | "both";
    readonly instructions?: string;
  };
}
```

- **labels** — Human-readable label strings the detector looks for (e.g.
  `["Customer ID", "Account No"]`).
- **position** — Where labels must appear relative to the candidate. Defaults to
  `"both"` when omitted.
- **instructions** — Free-text steering guidance for detectors with non-standard
  context rules. Use this as an escape hatch when the labels array isn't
  expressive enough.

### Example

```ts
const customerDetector: DetectorDefinition = {
  id: "customer_id",
  entityType: "customer_id",
  replacement: "[CUSTOMER_ID]",
  pattern: /\bCUST-\d{6}\b/u,
  context: { before: 20, after: 0 },
  contextHint: {
    labels: ["Customer ID", "Account No"],
    position: "preceding",
    instructions: "Label must appear on the same line before the value.",
  },
  validate({ before }) {
    if (/Customer ID|Account No/.test(before)) {
      return ["customer_id.context"];
    }
    return false;
  },
};
```

When `contextHint` is provided, `redactor.describe()` returns a `ContextHint`
object with `required: true`, the `labels` array, the `position`, the `window`
(derived from `context`), and the optional `instructions`. See
[LLM Steering](./llm-steering) for the full `ContextHint` shape.

### semanticConfirm

Optional function that enables semantic confirmation for this detector. When
provided, `redactAsync()` sends each candidate to Jev for verification before
redacting it. See [AI Confirmation](./semantic-confirmation) for the full
workflow.

The function receives `{ value, before, after }` and returns a
`SemanticQuestion` with `instructions` and optional `criteria`:

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

- **instructions** — A string or object describing the question to ask Jev.
- **criteria.true** — Description of what makes a candidate valid.
- **criteria.false** — Description of what makes a candidate invalid.
