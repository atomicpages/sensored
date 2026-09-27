# Cloud Key Detectors

## aws_access_key

Detects AWS access key IDs (AKIA followed by 16 base64 characters).

```ts
const redactor = createRedactor({
  rules: { aws_access_key: { action: "redact" } },
});

redactor.redact("Key: AKIAIOSFODNN7EXAMPLE");
// "Key: [AWS_ACCESS_KEY_1]"
```

- **ID**: `aws_access_key`
- **Entity type**: `aws_access_key`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: AKIA prefix + 16 base64 chars

## google_api_key

Detects Google API keys (AIza followed by 35 base64 characters).

```ts
const redactor = createRedactor({
  rules: { google_api_key: { action: "redact" } },
});

redactor.redact("Key: AIzaSyDQ-vFl0X0X0X0X0X0X0X0X0X0X0X0X0X");
// "Key: [GOOGLE_API_KEY_1]"
```

- **ID**: `google_api_key`
- **Entity type**: `google_api_key`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: AIza prefix + 35 base64 chars

## stripe_api_key

Detects Stripe API keys (sk_live_ or sk_test_ followed by alphanumeric
characters).

```ts
const redactor = createRedactor({
  rules: { stripe_api_key: { action: "redact" } },
});

redactor.redact("Key: sk_live_abc123def456");
// "Key: [STRIPE_API_KEY_1]"
```

- **ID**: `stripe_api_key`
- **Entity type**: `stripe_api_key`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: sk_live_ or sk_test_ prefix + alphanumeric chars

## slack_token

Detects Slack tokens (xoxb-, xoxp-, xoxa-, xoxr- followed by alphanumeric
characters).

```ts
const redactor = createRedactor({
  rules: { slack_token: { action: "redact" } },
});

redactor.redact("Token: xoxb-1234567890-abcdef");
// "Token: [SLACK_TOKEN_1]"
```

- **ID**: `slack_token`
- **Entity type**: `slack_token`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: xoxb-/xoxp-/xoxa-/xoxr- prefix + alphanumeric chars
