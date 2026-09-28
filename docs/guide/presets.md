# Presets

Presets are documented rule selections that bundle commonly-needed detectors for
specific use cases. They are not compliance guarantees — they're starting points
you can customize with explicit rule overrides.

## Built-in presets

| Preset       | Rules | Use case                            |
| ------------ | ----- | ----------------------------------- |
| `pii`        | 96    | Personally identifiable information |
| `gdpr`       | 39    | EU privacy regulation               |
| `hipaa`      | 29    | US healthcare                       |
| `ccpa`       | 86    | California privacy                  |
| `pci-dss`    | 6     | Payment card industry               |
| `healthcare` | 19    | Healthcare identifiers              |
| `finance`    | 15    | Financial identifiers               |
| `education`  | 6     | Education sector                    |
| `soc2`       | 30    | SOC 2 security controls             |
| `security`   | 14    | Secrets and network identifiers     |

## Combining presets

You can combine multiple presets. Rules are merged, and if two presets assign
different actions to the same rule, a `POLICY_CONFLICT` error is thrown — you
must resolve the conflict with an explicit rule override:

```ts
const redactor = createRedactor({
  presets: ["pii", "security"],
  rules: {
    // Override any conflicting rules here
    person_name_lite: { action: "mask", preserve: { first: 1 } },
  },
});
```

## Custom presets

Define your own presets with `customPresets`:

```ts
const redactor = createRedactor({
  customPresets: {
    my_preset: {
      email: { action: "redact" },
      phone: { action: "mask", preserve: { last: 4 } },
    },
  },
  presets: ["my_preset"],
  rules: {},
});
```

Custom presets do not support the `@N` version syntax.

## Overriding preset rules

Explicit rules in `config.rules` always take precedence over preset rules:

```ts
const redactor = createRedactor({
  presets: ["pii"],
  rules: {
    // Override email from redact to mask
    email: { action: "mask", preserve: { first: 2 } },
    // Disable person_name_lite from the preset
    person_name_lite: "off",
  },
});
```

Use `"off"` to disable a rule that a preset enabled.
