# Quick Start

## Basic redaction

```ts
import { createRedactor } from "sensored";

const redactor = createRedactor({ presets: ["pii"], rules: {} });

const text = "Contact me at john@example.com or call 555-123-4567.";
const redacted = redactor.redact(text);
// "Contact me at [EMAIL_1] or call [PHONE_1]."
```

The `pii` preset enables 96 detectors covering email, phone, payment cards,
national IDs, and more. All matches are replaced with numbered type labels like
`[EMAIL_1]`, `[PHONE_1]`.

## Inspecting detections

Use `inspect()` to see what was found without transforming the text:

```ts
const redactor = createRedactor({ presets: ["pii"], rules: {} });

const inspection = redactor.inspect("Email: john@example.com");
// {
//   text: "Email: john@example.com",
//   groups: [
//     {
//       start: 7,
//       end: 23,
//       replacement: "[EMAIL_1]",
//       matches: [
//         {
//           start: 7,
//           end: 23,
//           ruleId: "email",
//           entityType: "email",
//           reasons: ["email.regex"],
//           value: "john@example.com"
//         }
//       ]
//     }
//   ]
// }
```

## Restoration

Enable `restore: true` to get a restoration map alongside the redacted text:

```ts
const redactor = createRedactor({ presets: ["pii"], rules: {}, restore: true });

const { text, map } = redactor.redact("Email: john@example.com");
// text: "Email: [EMAIL_1]"
// map: { "[EMAIL_1]": "john@example.com" }

const restored = redactor.restore(text, map);
// "Email: john@example.com"
```

## Streaming

Process continuous text streams without buffering the entire input:

```ts
const redactor = createRedactor({ presets: ["pii"], rules: {} });

async function* asyncChunks() {
  yield "Contact me at john@";
  yield "example.com for details.";
}

const stream = redactor.stream(asyncChunks());
for await (const event of stream) {
  if (event.type === "text") {
    process.stdout.write(event.text);
  }
  // event.type === "detection" gives you InspectionGroup with offsets
  // event.type === "complete" gives you the optional restoration map
}
// Output: "Contact me at [EMAIL_1] for details."
```

## Custom detectors

Add your own detectors alongside the built-in ones:

```ts
import { createRedactor, type DetectorDefinition } from "sensored";

const employeeId: DetectorDefinition = {
  id: "employee_id",
  entityType: "employee_id",
  pattern: /\bEMP-\d{6}\b/g,
  replacement: "[EMPLOYEE_ID]",
};

const redactor = createRedactor({
  presets: ["pii"],
  rules: { employee_id: { action: "redact" } },
  detectors: [employeeId],
});

const result = redactor.redact("Contact: EMP-123456");
// "Contact: [EMPLOYEE_ID]"
```

## Using transformations

Beyond simple redaction, you can mask, remove, format-preserve, or token-replace:

```ts
const redactor = createRedactor({
  rules: {
    email: { action: "mask", preserve: { first: 2 } },
    phone: { action: "remove" },
    payment_card: { action: "format-preserve" },
    us_ssn: { action: "token-replace" },
  },
});

redactor.redact("Email: john@example.com, Phone: 555-123-4567");
// "Email: jo************, "
```

See the [Transformations guide](./transformations) for details on each action.

## AI confirmation

Opt into AI-powered verification to eliminate false positives. Jev confirms
each detected candidate before redacting:

```ts
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
```

Sync `redact()` and `stream()` are unaffected. Fails open if the AI provider
is unavailable. See [AI Confirmation](./semantic-confirmation) for full
details.
