# Restoration

Restoration mode enables reversible redaction. When enabled, redacted text uses
numbered placeholders and a restoration map records the original values.

## Enabling restoration

```ts
const redactor = createRedactor({
  presets: ["pii"],
  rules: {},
  restore: true,
});

const { text, map } = redactor.redact(
  "Email: john@example.com, Phone: 555-123-4567",
);
// text: "Email: [EMAIL_1], Phone: [PHONE_1]"
// map: {
//   "[EMAIL_1]": "john@example.com",
//   "[PHONE_1]": "555-123-4567"
// }
```

## Restoring text

Use `redactor.restore()` or the standalone `restore()` function to reverse
redaction:

```ts
const restored = redactor.restore(text, map);
// "Email: john@example.com, Phone: 555-123-4567"
```

```ts
import { restore } from "sensored";

const restored = restore(text, map);
```

## Numbered placeholders

Without restoration, all matches of the same type share a label: `[EMAIL]`,
`[PHONE]`. With restoration, each match gets a unique numbered placeholder:
`[EMAIL_1]`, `[EMAIL_2]`, `[PHONE_1]`.

This ensures the restoration map has unambiguous keys.

## RestorationMap

```ts
type RestorationMap = Readonly<Record<string, string>>;
```

A plain object mapping placeholder strings to their original values. You can
serialize it to JSON for storage or transmission:

```ts
const { text, map } = redactor.redact(input);

// Store or transmit
const json = JSON.stringify(map);

// Later
const restoredMap = JSON.parse(json) as RestorationMap;
const restored = redactor.restore(text, restoredMap);
```

## Streaming with restoration

Restoration works in streaming mode too. Enable it via `StreamOptions`:

```ts
const redactor = createRedactor({ presets: ["pii"], rules: {} });

const stream = redactor.stream(asyncChunks(), { restore: true });

for await (const event of stream) {
  if (event.type === "text") {
    process.stdout.write(event.text);
  }
  if (event.type === "complete") {
    console.log(event.map);
    // { "[EMAIL_1]": "john@example.com" }
  }
}
```

## Idempotency

Restoration is idempotent. Calling `restore()` on already-restored text is safe
— the placeholder pattern only matches `[UPPERCASE_N]` formats, so original text
won't be accidentally modified.

Redaction is also idempotent: re-redacting already-redacted text is a no-op
because the library detects existing placeholders and skips detection within
those spans.
