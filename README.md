<p align="center">
  <img src="assets/horizontal-light.svg" alt="sensored" width="400">
</p>

# sensored

A streaming-first PII redaction library for TypeScript. Detects and redacts
sensitive data with 155 regex detectors, optional NER, and AI-powered semantic
confirmation.

[Try the browser playground](https://atomicpages.github.io/sensored/playground)
— presets provide relevant sample input, processed locally and never uploaded.

## Install

```bash
bun add sensored
# or
npm install sensored
# or
deno add npm:sensored
```

## Runtime support

sensored runs on Node.js 20+, Bun, Deno, browsers, and edge runtimes
(Cloudflare Workers, Vercel Edge). The core library has zero runtime-specific
dependencies. CI smoke tests verify Node.js, Deno, and browser/edge
compatibility on every push.

> **Note:** The CLI requires Bun. The core library and adapters work everywhere.

For higher-recall person name detection via NER:

```bash
bun add compromise
```

For AI-powered semantic confirmation that eliminates false positives:

```bash
bun add @typesafe-ai/sdk
```

The default `person_name_lite` detector uses a lightweight regex + bloom filter
with zero runtime dependencies. Use `person_name` to opt into compromise.js NER:

```ts
import { createRedactor, preloadPersonNameDetector } from "sensored";

await preloadPersonNameDetector();

const redactor = createRedactor({
  rules: { person_name: { action: "redact" } },
});
```

The dependency loads only when preloaded. Alternatively, add
`@typesafe-ai/sdk` to let Jev confirm detections before redacting.

## Quick start

```ts
import { createRedactor } from "sensored";

const redactor = createRedactor({ presets: ["pii"], rules: {} });

const text = "Contact me at john@example.com or call 555-123-4567.";
const redacted = redactor.redact(text);
// "Contact me at [EMAIL_1] or call [PHONE_1]."
```

### Semantic confirmation

Opt-in AI-powered verification of detected PII candidates using Jev (TypeSafe
System One). Reduces false positives by asking a semantic model to confirm each
candidate before redacting.

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

Currently only `person_name_lite` is opted in. Sync `redact()` and `stream()`
are unaffected. Fails open if the AI provider is unavailable.

In independent evaluation against the evaluation corpus, `person_name_lite` with
Jev semantic confirmation achieved 100% precision and 100% recall — zero false
positives, zero false negatives.

### Restoration

```ts
const redactor = createRedactor({
  presets: ["pii"],
  rules: {},
  restore: true,
});

const { text, map } = redactor.redact("Email: john@example.com");
// text: "Email: [EMAIL_1]"
// map: { "[EMAIL_1]": "john@example.com" }

const restored = redactor.restore(text, map);
// "Email: john@example.com"
```

### Streaming

```ts
const redactor = createRedactor({ presets: ["pii"], rules: {} });

const stream = redactor.stream(asyncChunks());
for await (const event of stream) {
  if (event.type === "text") {
    process.stdout.write(event.text);
  }
}
```

## Adapters

sensored ships optional adapters for popular logging libraries and LLM
client SDKs. All adapters are opt-in via optional peer dependencies.

### Logger adapters

Redact PII from structured log records before they're serialized:

```ts
// Pino
import pino from "pino";
import { pinoRedact } from "sensored/loggers/pino";

const logger = pino({
  ...pinoRedact({ presets: ["pii"], rules: {} }),
});
```

```ts
// Winston
import winston from "winston";
import { winstonRedact } from "sensored/loggers/winston";

const redact = winstonRedact({ presets: ["pii"], rules: {} });
const redactFormat = winston.format((info) => {
  Object.assign(info, redact(info));
  return info;
})();
```

```ts
// Morgan
import { morganRedact } from "sensored/loggers/morgan";

const stream = morganRedact({ presets: ["pii"], rules: {} }, process.stdout);
```

```ts
// Bunyan
import { bunyanRedact } from "sensored/loggers/bunyan";

const stream = bunyanRedact({ presets: ["pii"], rules: {} }, process.stdout);
```

```ts
// log4js
import log4js from "log4js";

log4js.configure({
  appenders: {
    stdout: { type: "stdout" },
    redacted: {
      type: "sensored/loggers/log4js",
      appender: "stdout",
      redact: { presets: ["pii"], rules: {} },
    },
  },
  categories: { default: { appenders: ["redacted"], level: "info" } },
});
```

See the [Logger Redaction guide](https://atomicpages.github.io/sensored/guide/logger-redaction)
for full setup instructions.

### LLM client wrappers

Redact prompts before sending to LLM APIs and restore placeholders in
responses automatically:

```ts
// OpenAI
import OpenAI from "openai";
import { wrapOpenAI } from "sensored/adapters/openai";

const client = wrapOpenAI(new OpenAI(), { presets: ["pii"], rules: {} });
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Email john@example.com about order #123" }],
});
// Model receives redacted prompt; response is restored automatically.
```

```ts
// Anthropic
import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropic } from "sensored/adapters/anthropic";

const client = wrapAnthropic(new Anthropic(), { presets: ["pii"], rules: {} });
const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Email alice@example.com" }],
});
```

### Sessions

For multi-turn LLM conversations, `createSession` provides a persistent
redaction context that deduplicates PII across calls — the same value always
gets the same placeholder:

```ts
import { createSession } from "sensored";

const session = createSession({ presets: ["pii"], rules: {} });

const turn1 = session.redact("Email john@example.com");
// "Email [EMAIL_1]"
const turn2 = session.redact("Reply to john@example.com please");
// "Reply to [EMAIL_1] please"

// Restore placeholders in LLM responses
const restored = session.restore("Sure, I emailed [EMAIL_1]");
// "Sure, I emailed john@example.com"

// Access the map for persistence
const map = session.map; // { "[EMAIL_1]": "john@example.com" }

// Reset between conversations (preserves hydration map)
session.reset();
```

Pass a `Session` to `wrapOpenAI` or `wrapAnthropic` instead of a config to
use session-based redaction with LLM adapters. See the
[LLM Prompt Redaction guide](https://atomicpages.github.io/sensored/guide/llm-prompt-redaction)
for streaming, tool calls, and more.

## Presets

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
| `soc2`       | 56    | SOC 2 security controls             |
| `security`   | 40    | Secrets and network identifiers     |

Presets are documented rule selections, not compliance guarantees.

## Built-in detectors

155 detectors across 13 domains:

| Group         | Detectors                                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contact       | email, phone, address, postal_code                                                                                                                       |
| Financial     | payment_card, iban, eu_vat, swift_bic, uk_sort_code, us_routing, uk_bank_account, card_data, financial_reference, investment_account, payment_gateway_id |
| National ID   | us_ssn, uk_nino, ca_sin, au_tfn, jp_my_number, uk_nhs, us_itin, us_ein, nz_ird, + 56 more across Europe, Asia, Africa, Middle East, Americas, Oceania    |
| Identity      | passport, drivers_license, digital_identity, license_plate, vin, imei, imsi                                                                              |
| Person        | person_name (requires `compromise`), person_name_lite (lightweight regex + bloom filter)                                                                 |
| Network       | ipv4, ipv6, mac_address, url_with_auth, url_query_key                                                                                                    |
| Cloud Keys    | aws_access_key, google_api_key, stripe_api_key, slack_token, cloudflare_api_token, digitalocean_token                                                     |
| Tokens & Keys | github_token, jwt_token, private_key, generic_api_key, http_auth_header, + 18 more (sendgrid, huggingface, slack_webhook, telegram, gitlab, npm, openai, anthropic, shopify, twilio_sid, mailchimp, notion, sentry, heroku, linear, mailgun, okta, square, discord_bot, datadog, pagerduty, scaleway) |
| Healthcare    | us_npi, us_dea, medical_record_number, clinical_trial_id, medical_device_id, medical_code, medical_reference, genetic_info, health_insurance_id          |
| HR            | hr_identifier, hr_screening, hr_compensation, hr_recruitment                                                                                             |
| Legal         | legal_case, legal_license, legal_reference                                                                                                               |
| Crypto        | crypto_address, crypto_tx_hash                                                                                                                           |
| Logistics     | tracking_number                                                                                                                                          |

See the
[detector reference](https://atomicpages.github.io/sensored/detectors/overview)
for per-detector details.

## Custom detectors

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
```

## Allowlist

Exclude specific values from redaction:

```ts
const redactor = createRedactor({
  presets: ["pii"],
  rules: {},
  allowlist: ["john@example.com"],
});

redactor.redact("Contact john@example.com or jane@example.com");
// "Contact john@example.com or [EMAIL_1]."
```

## CLI

The `sensored` package includes a CLI for redacting, inspecting, and restoring
PII in text files and pipelines.

```bash
# Redact from stdin
echo "Contact john@example.com" | bunx sensored --preset pii
# Contact [EMAIL]

# Redact a file
bunx sensored input.txt output.txt --preset pii

# Inspect detections
echo "Contact john@example.com" | bunx sensored inspect --preset pii

# Restore with a map
bunx sensored restore redacted.txt --map map.json restored.txt
```

See the [CLI guide](https://atomicpages.github.io/sensored/guide/cli) for full
documentation.

## Development

```bash
bun install          # install dependencies
bun test             # run tests (5045 tests)
bun run typecheck    # typecheck src/ (no Bun types)
bun run typecheck:build  # typecheck src/ + cli/ (with Bun types)
bun run typecheck:test   # typecheck tests (with Bun types)
bun run lint         # lint
bun run build        # build dist/
bun run eval:generate && bun run eval:score  # run eval suite
bun run bench        # run benchmarks
```

## Acknowledgments

I would be remiss if I didn't give a lot of kudos to
[sam247](https://github.com/sam247) and their wonderful work on
[openredaction](https://github.com/sam247/openredaction) of which this project
is heavily inspired by.

[Trufflehog](https://github.com/trufflesecurity/trufflehog) is a great security scanner for git repos!

## License

MIT
