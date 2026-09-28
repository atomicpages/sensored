# Configuration

The `createRedactor` function accepts a `RedactorConfig` object that controls
which detectors are active, how they transform matches, and operational limits.

## RedactorConfig

```ts
interface RedactorConfig {
  presets?: readonly string[];
  customPresets?: Readonly<
    Record<string, Readonly<Record<string, RuleSetting | "off">>>
  >;
  limits?: { maxInputLength?: number };
  rules: Readonly<Record<string, RuleSetting | "off">>;
  detectors?: readonly DetectorDefinition[];
  restore?: boolean;
  allowlist?: readonly string[];
  semantic?: SemanticConfig;
}
```

### presets

An array of preset names to enable. Presets are expanded first, then explicit
rules override them. See [Presets](./presets) for details.

```ts
createRedactor({ presets: ["pii", "security"], rules: {} });
```

### customPresets

Define your own named presets. Custom presets do not support the `@N` version
syntax.

```ts
createRedactor({
  customPresets: {
    internal: {
      email: { action: "redact" },
      phone: { action: "mask", preserve: { last: 4 } },
    },
  },
  presets: ["internal"],
  rules: {},
});
```

### rules

Explicit rule settings that override or supplement preset rules. Use `"off"` to
disable a rule from a preset.

```ts
createRedactor({
  presets: ["pii"],
  rules: {
    email: { action: "mask", preserve: { first: 2 } },
    person_name_lite: "off",
  },
});
```

### detectors

Custom detector definitions to register alongside the built-in detectors. See
[Custom Detectors](./custom-detectors) for the full contract.

```ts
createRedactor({
  presets: ["pii"],
  rules: { employee_id: { action: "redact" } },
  detectors: [employeeIdDetector],
});
```

### restore

When `true`, `redact()` returns `{ text, map }` instead of a plain string. The
map contains placeholder-to-original-value mappings for restoration. See
[Restoration](./restoration) for details.

```ts
const redactor = createRedactor({
  presets: ["pii"],
  rules: {},
  restore: true,
});

const { text, map } = redactor.redact("Email: john@example.com");
```

### limits

```ts
createRedactor({
  presets: ["pii"],
  rules: {},
  limits: { maxInputLength: 100_000 },
});
```

- **maxInputLength** — Maximum input length in UTF-16 code units. Default:
  `1,048,576` (1 MiB). Inputs exceeding this limit throw an `INPUT_LIMIT` error.

The streaming buffer limit is fixed at `65,536` UTF-16 code units. If the
internal buffer exceeds this, a `BUFFER_LIMIT` error is thrown.

### allowlist

An array of exact-match strings exempt from redaction. Case-sensitive, no regex.
Allowlisted values never appear in restoration maps.

```ts
createRedactor({
  presets: ["pii"],
  rules: {},
  allowlist: ["john@example.com"],
});
```

### semantic

Optional semantic confirmation configuration. When provided, `redactAsync()`
uses Jev (TypeSafe System One) to verify detected PII candidates before
redacting them. See [AI Confirmation](./semantic-confirmation) for details.

```ts
createRedactor({
  rules: { person_name_lite: { action: "redact" } },
  semantic: {
    provider: "jev",
    apiKey: process.env.TYPESAFE_API_KEY!,
  },
});
```

## RuleSetting

Each rule can be one of five action types:

```ts
type RuleSetting =
  | { action: "redact"; replacement?: string; priority?: number }
  | { action: "mask"; preserve?: { first?: number; last?: number } }
  | { action: "remove" }
  | { action: "format-preserve" }
  | { action: "token-replace"; tokens?: Readonly<Record<string, string>> };
```

See [Transformations](./transformations) for examples of each action.

## Validation

Configuration is validated at creation time. Common errors:

- **EMPTY_POLICY** — No rules are enabled (all set to `"off"` or no
  presets/rules provided)
- **UNKNOWN_RULE** — A rule or preset name doesn't exist
- **POLICY_CONFLICT** — Two presets assign different actions to the same rule
- **INVALID_CONFIG** — Configuration shape is invalid
- **DETECTOR_CONTRACT** — A custom detector violates its declared contract

See [Errors](./errors) for the full error reference.
