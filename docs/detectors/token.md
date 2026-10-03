# Token & Key Detectors

## github_token

Detects GitHub personal access tokens (ghp_, gho_, ghu_, ghs_, ghr_ followed by
36 base62 characters).

```ts
const redactor = createRedactor({
  rules: { github_token: { action: "redact" } },
});

redactor.redact("Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz1234");
// "Token: [GITHUB_TOKEN_1]"
```

- **ID**: `github_token`
- **Entity type**: `github_token`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: ghp_/gho_/ghu_/ghs_/ghr_ prefix + 36 base62 chars

## jwt_token

Detects JWT tokens (3 base64url segments separated by dots).

```ts
const redactor = createRedactor({
  rules: { jwt_token: { action: "redact" } },
});

redactor.redact(
  "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123",
);
// "Authorization: Bearer [JWT_TOKEN_1]"
```

- **ID**: `jwt_token`
- **Entity type**: `jwt_token`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: 3 base64url segments separated by dots

## private_key

Detects PEM-encoded private keys (RSA, EC, OpenSSH, PGP).

```ts
const redactor = createRedactor({
  rules: { private_key: { action: "redact" } },
});

redactor.redact(
  "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----",
);
// "[PRIVATE_KEY_1]"
```

- **ID**: `private_key`
- **Entity type**: `private_key`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: PEM header/footer for RSA, EC, OpenSSH, or PGP keys

## generic_api_key

Detects generic API keys with context labels. Requires nearby labels like "API
key", "API secret", "access token", etc.

```ts
const redactor = createRedactor({
  rules: { generic_api_key: { action: "redact" } },
});

redactor.redact("API key: sk_test_1234567890abcdef");
// "API key: [GENERIC_API_KEY_1]"
```

- **ID**: `generic_api_key`
- **Entity type**: `generic_api_key`
- **Context required**: Yes (labels: API key, API secret, access token, etc.)
- **Stream supported**: Yes
- **Validation**: Context label presence

## http_auth_header

Detects HTTP authorization header values (`Authorization: Basic/Bearer/Digest`,
`Proxy-Authorization: Basic/Bearer/Digest`, `Api-Key`, `ApiKey`,
`Ocp-Apim-Subscription-Key`, `X-*-Key/Token/Secret`). Only redacts the value,
not the header name.

```ts
const redactor = createRedactor({
  rules: { http_auth_header: { action: "redact" } },
});

redactor.redact("Authorization: Basic dXNlcjpwYXNzMTIz");
// "Authorization: Basic [HTTP_AUTH_HEADER_1]"
```

Custom header patterns can be configured via `detectorOptions`:

```ts
const redactor = createRedactor({
  rules: { http_auth_header: { action: "redact" } },
  detectorOptions: {
    http_auth_header: {
      customHeaders: [
        "X-My-Service-Key", // string: escaped as literal
        /X-Custom-Auth\s*:\s*(\S+)/, // RegExp: source used directly
      ],
    },
  },
});
```

- **ID**: `http_auth_header`
- **Entity type**: `http_auth_header`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Known header name or custom pattern match

## sendgrid_api_key

Detects SendGrid API keys (SG. prefix + two base64url segments).

- **ID**: `sendgrid_api_key`
- **Entity type**: `sendgrid_api_key`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: SG. prefix + base64url segments

## huggingface_token

Detects HuggingFace access tokens (hf_ or api_org_ prefix + 34 alphanumeric
chars).

- **ID**: `huggingface_token`
- **Entity type**: `huggingface_token`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: hf_/api_org_ prefix + 34 alphanumeric chars

## slack_webhook_url

Detects Slack webhook URLs (https://hooks.slack.com/services/...).

- **ID**: `slack_webhook_url`
- **Entity type**: `slack_webhook_url`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: hooks.slack.com/services URL structure

## telegram_bot_token

Detects Telegram bot tokens (numeric bot ID + :AA + 35 alphanumeric chars).

- **ID**: `telegram_bot_token`
- **Entity type**: `telegram_bot_token`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Numeric ID + :AA + 35 chars

## gitlab_token

Detects GitLab personal access tokens (glpat- prefix + 20-22 alphanumeric
chars).

- **ID**: `gitlab_token`
- **Entity type**: `gitlab_token`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: glpat- prefix + 20-22 chars

## npm_token

Detects npm publish tokens (npm_ prefix + 36 alphanumeric chars).

- **ID**: `npm_token`
- **Entity type**: `npm_token`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: npm_ prefix + 36 alphanumeric chars

## openai_api_key

Detects OpenAI API keys (sk- prefix + alphanumeric chars containing T3BlbkFJ).

- **ID**: `openai_api_key`
- **Entity type**: `openai_api_key`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: sk- prefix + T3BlbkFJ marker

## anthropic_api_key

Detects Anthropic API keys (sk-ant-admin01- or sk-ant-api03- prefix + 93 word
chars + AA).

- **ID**: `anthropic_api_key`
- **Entity type**: `anthropic_api_key`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: sk-ant- prefix + word chars + AA suffix

## shopify_token

Detects Shopify API tokens (shppa_, shpat_, shpca_ + 32-38 hex chars, or
shpss_ + 32-38 hex chars).

- **ID**: `shopify_token`
- **Entity type**: `shopify_token`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: shppa_/shpat_/shpca_/shpss_ prefix + 32-38 hex chars

## twilio_sid

Detects Twilio Account SIDs (AC prefix + 32 hex characters).

- **ID**: `twilio_sid`
- **Entity type**: `twilio_sid`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: AC prefix + 32 hex chars

## mailchimp_api_key

Detects Mailchimp API keys (32 hex chars + -us + 1-2 digits).

- **ID**: `mailchimp_api_key`
- **Entity type**: `mailchimp_api_key`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: 32 hex chars + -us suffix

## notion_token

Detects Notion integration tokens (secret_ or ntn_ prefix + 43 alphanumeric
chars).

- **ID**: `notion_token`
- **Entity type**: `notion_token`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: secret_/ntn_ prefix + 43 alphanumeric chars

## sentry_token

Detects Sentry auth tokens (sntrys_eyJ prefix + 197 base64 chars, or sntryu_ +
64 hex chars).

- **ID**: `sentry_token`
- **Entity type**: `sentry_token`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: sntrys_eyJ/sntryu_ prefix + base64/hex chars

## heroku_api_key

Detects Heroku API keys (HRKU- prefix + 60 alphanumeric/underscore/hyphen
chars).

- **ID**: `heroku_api_key`
- **Entity type**: `heroku_api_key`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: HRKU- prefix + 60 chars

## linear_api_key

Detects Linear API keys (lin_api_ prefix + 40 alphanumeric chars).

- **ID**: `linear_api_key`
- **Entity type**: `linear_api_key`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: lin_api_ prefix + 40 alphanumeric chars

## mailgun_api_key

Detects Mailgun API keys (key- prefix + 32 chars, or UUID format). Requires
"mailgun" keyword within 40 chars.

- **ID**: `mailgun_api_key`
- **Entity type**: `mailgun_api_key`
- **Context required**: Yes (keyword: mailgun)
- **Stream supported**: Yes
- **Validation**: key- prefix + 32 chars or UUID format

## okta_token

Detects Okta API tokens (00 prefix + 40 alphanumeric/underscore/hyphen chars).
Requires "okta" keyword within 40 chars.

- **ID**: `okta_token`
- **Entity type**: `okta_token`
- **Context required**: Yes (keyword: okta)
- **Stream supported**: Yes
- **Validation**: 00 prefix + 40 chars

## square_token

Detects Square API tokens (EAAA + 60 chars, sq0atp- + 36 chars, or sq0csp- + 43
chars). Requires "square" keyword within 40 chars.

- **ID**: `square_token`
- **Entity type**: `square_token`
- **Context required**: Yes (keyword: square)
- **Stream supported**: Yes
- **Validation**: EAAA/sq0atp-/sq0csp- prefix + chars

## discord_bot_token

Detects Discord bot tokens (3 dot-separated segments: 24 + 6 + 27 chars).
Requires "discord" keyword within 40 chars.

- **ID**: `discord_bot_token`
- **Entity type**: `discord_bot_token`
- **Context required**: Yes (keyword: discord)
- **Stream supported**: Yes
- **Validation**: 3 dot-separated base64 segments

## datadog_api_key

Detects Datadog API keys (40 or 32 alphanumeric chars). Requires "datadog" or
"dd" keyword within 40 chars.

- **ID**: `datadog_api_key`
- **Entity type**: `datadog_api_key`
- **Context required**: Yes (keyword: datadog, dd)
- **Stream supported**: Yes
- **Validation**: 40 or 32 alphanumeric chars

## pagerduty_token

Detects PagerDuty API tokens (letter + 19 alphanumeric/underscore/plus chars).
Requires "pagerduty", "pager_duty", "pd_", or "pd-" keyword within 40 chars.

- **ID**: `pagerduty_token`
- **Entity type**: `pagerduty_token`
- **Context required**: Yes (keyword: pagerduty, pager_duty, pd_, pd-)
- **Stream supported**: Yes
- **Validation**: letter + 19 chars

## scaleway_key

Detects Scaleway API keys (UUID format: 8-4-4-4-12 lowercase alphanumeric).
Requires "scaleway" keyword within 40 chars.

- **ID**: `scaleway_key`
- **Entity type**: `scaleway_key`
- **Context required**: Yes (keyword: scaleway)
- **Stream supported**: Yes
- **Validation**: UUID format
