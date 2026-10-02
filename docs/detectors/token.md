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
`Ocp-Apim-Subscription-Key`, `X-*-Key/Token/Secret`). Only redacts the
value, not the header name.

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
        "X-My-Service-Key",           // string: escaped as literal
        /X-Custom-Auth\s*:\s*(\S+)/,  // RegExp: source used directly
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
