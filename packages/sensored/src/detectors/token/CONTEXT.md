# Token and key detectors

All built-in token/key detectors live under `detectors/token/` and extend the
`Detector` base class directly (context-optional) or the `KeywordDetector` base
class (keyword-dependent, requires a keyword within 40 chars of the match).
Each is exported as a singleton and registered in `detectors/registry.ts`.

```
token/
  github-token.ts           GitHubTokenDetector — GitHub personal access tokens
  jwt-token.ts              JwtTokenDetector — JSON Web Tokens
  private-key.ts            PrivateKeyDetector — PEM private keys (RSA, EC, DSA, OpenSSH)
  generic-api-key.ts        GenericApiKeyDetector — context-labeled API keys
  http-auth-header.ts       HttpAuthHeaderDetector — HTTP auth header values
  sendgrid-api-key.ts       SendGridApiKeyDetector — SendGrid API keys
  huggingface-token.ts      HuggingFaceTokenDetector — HuggingFace access tokens
  slack-webhook-url.ts      SlackWebhookUrlDetector — Slack webhook URLs
  telegram-bot-token.ts     TelegramBotTokenDetector — Telegram bot tokens
  gitlab-token.ts           GitLabTokenDetector — GitLab personal access tokens
  npm-token.ts              NpmTokenDetector — npm publish tokens
  openai-api-key.ts          OpenAIApiKeyDetector — OpenAI API keys
  anthropic-api-key.ts      AnthropicApiKeyDetector — Anthropic API keys
  shopify-token.ts          ShopifyTokenDetector — Shopify API tokens
  twilio-sid.ts             TwilioSidDetector — Twilio Account SIDs
  mailchimp-api-key.ts      MailchimpApiKeyDetector — Mailchimp API keys
  notion-token.ts           NotionTokenDetector — Notion integration tokens
  sentry-token.ts           SentryTokenDetector — Sentry auth tokens
  heroku-api-key.ts         HerokuApiKeyDetector — Heroku API keys
  linear-api-key.ts         LinearApiKeyDetector — Linear API keys
  mailgun-api-key.ts        MailgunApiKeyDetector — Mailgun API keys (keyword)
  okta-token.ts             OktaTokenDetector — Okta API tokens (keyword)
  square-token.ts           SquareTokenDetector — Square API tokens (keyword)
  discord-bot-token.ts      DiscordBotTokenDetector — Discord bot tokens (keyword)
  datadog-api-key.ts        DatadogApiKeyDetector — Datadog API keys (keyword)
  pagerduty-token.ts        PagerDutyTokenDetector — PagerDuty API tokens (keyword)
  scaleway-key.ts           ScalewayKeyDetector — Scaleway API keys (keyword)
```

### github_token

Detects GitHub personal access tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`,
`ghr_` + 36+ alphanumeric characters). Distinctive prefix — context-optional.
`maxMatchLength: 255`. Exported as a singleton.

### jwt_token

Detects JSON Web Tokens (`eyJ`-prefixed base64url segments separated by dots).
Distinctive prefix — context-optional. `maxMatchLength: 4096`. Exported as a
singleton.

### private_key

Detects PEM-format private keys (RSA, EC, DSA, OpenSSH) delimited by
`-----BEGIN ... PRIVATE KEY-----` and `-----END ... PRIVATE KEY-----` markers.
Multi-line matching via `[\s\S]`. Context-optional. `maxMatchLength: 65536`.
Exported as a singleton.

### generic_api_key

Detects API keys labeled by surrounding context (e.g., `api_key: abc123...`,
`apikey=xyz789...`). Matches the label + separator + key value, but only
redacts the key value portion. Excludes placeholder values (example, sample,
test, fake, demo). Context-required (label must be present).
`maxMatchLength: 256`. Exported as a singleton.

### http_auth_header

Detects HTTP authorization header values (`Authorization: Basic/Bearer/Digest <value>`,
`Proxy-Authorization: Basic/Bearer/Digest <value>`, `Api-Key: <value>`,
`ApiKey: <value>`, `Ocp-Apim-Subscription-Key: <value>`,
`X-*-Key: <value>`, `X-*-Token: <value>`, `X-*-Secret: <value>`).
Only redacts the value (capturing group 1), not the header name.
Context-optional. `maxMatchLength: 1024`. Exported as a singleton.
Supports custom header patterns via `detectorOptions.http_auth_header.customHeaders`
(strings are escaped as literals; RegExps use their source).
Note: Digest values containing whitespace (e.g., `username="admin", realm="api"`)
are only partially redacted — `(\S+)` stops at the first space.

### sendgrid_api_key

Detects SendGrid API keys (`SG.` + two base64url segments). Distinctive prefix
— context-optional. `maxMatchLength: 100`. Exported as a singleton.

### huggingface_token

Detects HuggingFace access tokens (`hf_` or `api_org_` + 34 alphanumeric
characters). Distinctive prefix — context-optional. `maxMatchLength: 42`.
Exported as a singleton.

### slack_webhook_url

Detects Slack webhook URLs (`https://hooks.slack.com/services/T.../B.../...`).
Distinctive URL structure — context-optional. `maxMatchLength: 120`.
Exported as a singleton.

### telegram_bot_token

Detects Telegram bot tokens (numeric bot ID + `:AA` + 35 alphanumeric/underscore/
hyphen characters). Distinctive prefix — context-optional. `maxMatchLength: 60`.
Exported as a singleton.

### gitlab_token

Detects GitLab personal access tokens (`glpat-` + 20–22 alphanumeric/hyphen/
equals characters). Distinctive prefix — context-optional. `maxMatchLength: 30`.
Exported as a singleton.

### npm_token

Detects npm publish tokens (`npm_` + 36 alphanumeric characters). Distinctive
prefix — context-optional. `maxMatchLength: 40`. Exported as a singleton.

### openai_api_key

Detects OpenAI API keys (`sk-` + alphanumeric chars + `T3BlbkFJ` + alphanumeric
chars). Distinctive prefix — context-optional. `maxMatchLength: 200`.
Exported as a singleton.

### anthropic_api_key

Detects Anthropic API keys (`sk-ant-admin01-` or `sk-ant-api03-` + 93 word
chars + `AA`). Distinctive prefix — context-optional. `maxMatchLength: 110`.
Exported as a singleton.

### shopify_token

Detects Shopify API tokens (`shppa_`, `shpat_`, `shpca_` + 32–38 hex chars,
or `shpss_` + 32–38 hex chars). Distinctive prefix — context-optional.
`maxMatchLength: 44`. Exported as a singleton.

### twilio_sid

Detects Twilio Account SIDs (`AC` + 32 hex characters). Distinctive prefix
— context-optional. `maxMatchLength: 34`. Exported as a singleton.

### mailchimp_api_key

Detects Mailchimp API keys (32 hex chars + `-us` + 1–2 digits). Distinctive
suffix — context-optional. `maxMatchLength: 40`. Exported as a singleton.

### notion_token

Detects Notion integration tokens (`secret_` or `ntn_` + 43 alphanumeric
characters). Distinctive prefix — context-optional. `maxMatchLength: 50`.
Exported as a singleton.

### sentry_token

Detects Sentry auth tokens (`sntrys_eyJ` + 197 base64 chars, or `sntryu_` +
64 hex chars). Distinctive prefix — context-optional. `maxMatchLength: 210`.
Exported as a singleton.

### heroku_api_key

Detects Heroku API keys (`HRKU-` + 60 alphanumeric/underscore/hyphen chars).
Distinctive prefix — context-optional. `maxMatchLength: 65`. Exported as a
singleton.

### linear_api_key

Detects Linear API keys (`lin_api_` + 40 alphanumeric characters). Distinctive
prefix — context-optional. `maxMatchLength: 48`. Exported as a singleton.

### mailgun_api_key

Detects Mailgun API keys (`key-` + 32 lowercase alphanumeric, or UUID format).
Keyword-dependent — requires "mailgun" within 40 chars. `maxMatchLength: 80`.
Exported as a singleton.

### okta_token

Detects Okta API tokens (`00` + 40 alphanumeric/underscore/hyphen chars).
Keyword-dependent — requires "okta" within 40 chars. `maxMatchLength: 42`.
Exported as a singleton.

### square_token

Detects Square API tokens (`EAAA` + 60 alphanumeric/hyphen/plus/equals chars,
`sq0atp-` + 36 alphanumeric/underscore/hyphen chars, or `sq0csp-` + 43
alphanumeric/underscore/hyphen chars). Keyword-dependent — requires "square"
within 40 chars. `maxMatchLength: 64`. Exported as a singleton.

### discord_bot_token

Detects Discord bot tokens (3 dot-separated segments: 24 + 6 + 27 alphanumeric/
underscore/hyphen chars). Keyword-dependent — requires "discord" within 40
chars. `maxMatchLength: 60`. Exported as a singleton.

### datadog_api_key

Detects Datadog API keys (40 or 32 alphanumeric characters). Keyword-dependent
— requires "datadog" or "dd" within 40 chars. `maxMatchLength: 40`.
Exported as a singleton.

### pagerduty_token

Detects PagerDuty API tokens (letter + 19 alphanumeric/underscore/plus chars).
Keyword-dependent — requires "pagerduty", "pager_duty", "pd_", or "pd-"
within 40 chars. `maxMatchLength: 20`. Exported as a singleton.

### scaleway_key

Detects Scaleway API keys (UUID format: 8-4-4-4-12 lowercase alphanumeric).
Keyword-dependent — requires "scaleway" within 40 chars. `maxMatchLength: 36`.
Exported as a singleton.
