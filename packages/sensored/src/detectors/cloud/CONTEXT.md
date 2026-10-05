# Cloud provider key detectors

All built-in cloud provider key detectors live under `detectors/cloud/` and
extend the `Detector` base class directly. Each is exported as a singleton and
registered in `detectors/registry.ts`.

```
cloud/
  aws-access-key.ts         AwsAccessKeyDetector — AWS Access Key IDs
  google-api-key.ts         GoogleApiKeyDetector — Google API keys
  stripe-api-key.ts          StripeApiKeyDetector — Stripe API keys
  slack-token.ts             SlackTokenDetector — Slack API tokens
  cloudflare-api-token.ts    CloudflareApiTokenDetector — Cloudflare API tokens
  digitalocean-token.ts      DigitalOceanTokenDetector — DigitalOcean API tokens
```

### aws_access_key

Detects AWS Access Key IDs (`AKIA` + 16 uppercase alphanumeric characters).
Distinctive prefix — context-optional. `maxMatchLength: 20`. Exported as a
singleton.

### google_api_key

Detects Google API keys (`AIza` + 35 base64url characters). Distinctive prefix
— context-optional. `maxMatchLength: 39`. Exported as a singleton.

### stripe_api_key

Detects Stripe API keys (`sk_live_`, `sk_test_`, `pk_live_`, `pk_test_`
prefixes + 24+ alphanumeric characters). Distinctive prefix — context-optional.
`maxMatchLength: 128`. Exported as a singleton.

### cloudflare_api_token

Detects Cloudflare API tokens (`cfk_`, `cfut_`, `cfat_` prefixes + 20+
alphanumeric/underscore/hyphen characters). Distinctive prefix — context-optional.
`maxMatchLength: 100`. Exported as a singleton.

### digitalocean_token

Detects DigitalOcean API tokens (`dop_v1_`, `doo_v1_`, or `dor_v1_` + 64 hex
characters). Distinctive prefix — context-optional. `maxMatchLength: 71`.
Exported as a singleton.

### slack_token

Detects Slack API tokens (`xox[baprs]-` + 10+ alphanumeric/hyphen characters).
Distinctive prefix — context-optional. `maxMatchLength: 128`. Exported as a
singleton.
