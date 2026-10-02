# Network Detectors

## ipv4

Detects IPv4 addresses (4 octets, 0–255 each).

```ts
const redactor = createRedactor({
  rules: { ipv4: { action: "redact" } },
});

redactor.redact("Server: 192.168.1.100");
// "Server: [IPV4_1]"
```

- **ID**: `ipv4`
- **Entity type**: `ipv4`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Octet range (0–255)

## ipv6

Detects IPv6 addresses (8 groups of 4 hex digits with zero-compression support).

```ts
const redactor = createRedactor({
  rules: { ipv6: { action: "redact" } },
});

redactor.redact("Server: 2001:0db8:85a3:0000:0000:8a2e:0370:7334");
// "Server: [IPV6_1]"
```

- **ID**: `ipv6`
- **Entity type**: `ipv6`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Hex group format, zero-compression (::) support

## mac_address

Detects MAC addresses (6 hex pairs, colon or hyphen separated).

```ts
const redactor = createRedactor({
  rules: { mac_address: { action: "redact" } },
});

redactor.redact("MAC: 00:1A:2B:3C:4D:5E");
// "MAC: [MAC_ADDRESS_1]"
```

- **ID**: `mac_address`
- **Entity type**: `mac_address`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: 6 hex pairs with colon or hyphen separators

## url_with_auth

Detects URLs with embedded credentials (`https://user:pass@host`).

```ts
const redactor = createRedactor({
  rules: { url_with_auth: { action: "redact" } },
});

redactor.redact("Endpoint: https://admin:secret@api.example.com");
// "Endpoint: [URL_WITH_AUTH_1]"
```

- **ID**: `url_with_auth`
- **Entity type**: `url_with_auth`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: URL with userinfo component (user:password@)

## url_query_key

Detects credential values in URL query parameters (e.g.,
`?api_key=secret123`). Matches 24 sensitive parameter names including
`api_key`, `access_token`, `auth_token`, `secret`, `private_key`, and
`oauth_token`. Only redacts the value, not the parameter name or URL.

```ts
const redactor = createRedactor({
  rules: { url_query_key: { action: "redact" } },
});

redactor.redact("https://api.example.com/data?api_key=sk_test_123456");
// "https://api.example.com/data?api_key=[URL_QUERY_KEY_1]"
```

- **ID**: `url_query_key`
- **Entity type**: `url_query_key`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Known credential parameter name in query string
