# Transformations

`sensored` supports five transformation actions. Each detector rule specifies
which action to apply when a match is found.

## Action precedence

When matches overlap, actions are resolved by precedence:

**remove > redact > format-preserve > token-replace > mask**

The highest-precedence action in an overlap group wins.

## redact

Replaces the matched span with a type label like `[EMAIL]`. When restoration is
enabled, labels are numbered: `[EMAIL_1]`, `[EMAIL_2]`, etc.

```ts
const redactor = createRedactor({
  rules: { email: { action: "redact" } },
});

redactor.redact("Contact: john@example.com");
// "Contact: [EMAIL_1]"
```

You can provide a custom `replacement` string and `priority`:

```ts
const redactor = createRedactor({
  rules: {
    email: { action: "redact", replacement: "[REDACTED]", priority: 10 },
  },
});
```

## mask

Preserves the first and/or last N grapheme clusters, replacing the rest with
`*`. Useful when you need to show partial values for verification.

```ts
const redactor = createRedactor({
  rules: {
    email: { action: "mask", preserve: { first: 2 } },
    phone: { action: "mask", preserve: { first: 3, last: 4 } },
  },
});

redactor.redact("Email: john@example.com, Phone: 555-123-4567");
// "Email: jo************, Phone: 555-****-4567"
```

- `preserve.first` — number of leading grapheme clusters to keep
- `preserve.last` — number of trailing grapheme clusters to keep

If neither is specified, the entire match is replaced with `*` characters.

## remove

Deletes the matched span entirely from the output.

```ts
const redactor = createRedactor({
  rules: { phone: { action: "remove" } },
});

redactor.redact("Call 555-123-4567 now");
// "Call  now"
```

## format-preserve

Transforms digits to `X` and letters to `*` while preserving separators,
spaces, and structural characters. Useful when you need to maintain the format
of the original text for downstream parsing.

```ts
const redactor = createRedactor({
  rules: { payment_card: { action: "format-preserve" } },
});

redactor.redact("Card: 4532-1234-5678-9012");
// "Card: ****-****-****-****"
```

## token-replace

Generates deterministic fake data per entity type using FNV-1a 32-bit hashing.
The same input always produces the same fake output, making it useful for
consistent test data or anonymized datasets.

```ts
const redactor = createRedactor({
  rules: { email: { action: "token-replace" } },
});

redactor.redact("Email: john@example.com");
// "Email: alicia.morgan@exmail.net"

// Same input always produces the same token
redactor.redact("Email: john@example.com");
// "Email: alicia.morgan@exmail.net"
```

You can provide custom token mappings to override the default generators:

```ts
const redactor = createRedactor({
  rules: {
    email: {
      action: "token-replace",
      tokens: { email: "redacted@example.com" },
    },
  },
});
```

## Idempotency

All transformations are idempotent. Re-redacting already-redacted text is a
no-op — the library detects placeholder patterns like `[EMAIL]` and
`[EMAIL_1]` and skips detection within those spans.
