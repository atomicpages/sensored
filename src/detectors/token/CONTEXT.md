# Token and key detectors

All built-in token/key detectors live under `detectors/token/` and extend the
`Detector` base class directly. Each is exported as a singleton and registered
in `detectors/registry.ts`.

```
token/
  github-token.ts       GitHubTokenDetector — GitHub personal access tokens
  jwt-token.ts          JwtTokenDetector — JSON Web Tokens
  private-key.ts        PrivateKeyDetector — PEM private keys (RSA, EC, DSA, OpenSSH)
  generic-api-key.ts    GenericApiKeyDetector — context-labeled API keys
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
