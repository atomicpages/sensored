# Network detectors

All built-in network detectors live under `detectors/network/` and extend the
`Detector` base class directly. Each is exported as a singleton and registered
in `detectors/registry.ts`.

```
network/
  ipv4.ts            IPv4Detector — public IPv4 addresses
  ipv6.ts            IPv6Detector — public IPv6 addresses
  mac-address.ts     MacAddressDetector — MAC addresses (colon/hyphen)
  url-with-auth.ts   UrlWithAuthDetector — URLs with embedded credentials
```

### ipv4

Detects public IPv4 addresses. Excludes private ranges (10.x, 172.16-31.x,
192.168.x), loopback (127.x), broadcast (255.255.255.255), and 0.0.0.0.
Context-optional. `maxMatchLength: 15`. Exported as a singleton.

### ipv6

Detects public IPv6 addresses in full and compressed (`::`) notation. Excludes
`::1` (loopback), `fe80::` (link-local), and `::` (unspecified). Validates
structural correctness: at most one `::`, 1–8 groups, each group 1–4 hex digits.
Context-optional. `maxMatchLength: 39`. Exported as a singleton.

### mac_address

Detects MAC addresses in colon (`XX:XX:XX:XX:XX:XX`) or hyphen
(`XX-XX-XX-XX-XX-XX`) notation. Context-optional. `maxMatchLength: 17`.
Exported as a singleton.

### url_with_auth

Detects URLs with embedded credentials (e.g., `https://user:pass@example.com`).
Matches `http://`, `https://`, and `ftp://` schemes. Context-optional.
`maxMatchLength: 2048`. Exported as a singleton.
