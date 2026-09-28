<p align="center">
  <img src="assets/horizontal-light.svg" alt="sensored" width="400">
</p>

# sensored

A streaming-first PII redaction library for TypeScript. Detects and redacts
sensitive data with 129 regex detectors, optional NER, and AI-powered semantic
confirmation.

## Install

```bash
bun add sensored
```

For higher-recall person name detection via NER:

```bash
bun add compromise
```

For AI-powered semantic confirmation that eliminates false positives:

```bash
bun add @typesafe-ai/sdk
```

The default `person_name_lite` detector uses a lightweight regex + bloom filter
with zero runtime dependencies. Use `person_name` to opt into compromise.js NER,
or add `@typesafe-ai/sdk` to let Jev confirm detections before redacting.

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
System One). Reduces false positives by asking a semantic model to confirm
each candidate before redacting.

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
| `soc2`       | 30    | SOC 2 security controls             |
| `security`   | 14    | Secrets and network identifiers     |

Presets are documented rule selections, not compliance guarantees.

## Built-in detectors

129 detectors across 13 domains:

| Group         | Detectors                                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contact       | email, phone, address, postal_code                                                                                                                       |
| Financial     | payment_card, iban, eu_vat, swift_bic, uk_sort_code, us_routing, uk_bank_account, card_data, financial_reference, investment_account, payment_gateway_id |
| National ID   | us_ssn, uk_nino, ca_sin, au_tfn, jp_my_number, uk_nhs, us_itin, us_ein, nz_ird, + 56 more across Europe, Asia, Africa, Middle East, Americas, Oceania    |
| Identity      | passport, drivers_license, digital_identity, license_plate, vin, imei, imsi                                                                              |
| Person        | person_name (requires `compromise`), person_name_lite (lightweight regex + bloom filter)                                                                 |
| Network       | ipv4, ipv6, mac_address, url_with_auth                                                                                                                   |
| Cloud Keys    | aws_access_key, google_api_key, stripe_api_key, slack_token                                                                                              |
| Tokens & Keys | github_token, jwt_token, private_key, generic_api_key                                                                                                    |
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
bun test             # run tests (4835 tests)
bun run typecheck    # typecheck
bun run lint         # lint
bun run build        # build dist/
bun run eval:generate && bun run eval:score  # run eval suite
bun run bench        # run benchmarks
```

## License

MIT
