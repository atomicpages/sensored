# Changelog

## 129 detectors, 13 domains, 11 presets

### Detectors

**Identity (3):** vin, imei, imsi
**Logistics (1):** tracking_number

### Presets

- `pii` — 96 rules
- `gdpr` — 39 rules
- `hipaa` — 29 rules
- `ccpa` — 86 rules
- `pci-dss` — 6 rules
- `healthcare` — 19 rules
- `finance` — 15 rules
- `education` — 6 rules
- `soc2` — 30 rules
- `security` — 14 rules

### Performance

- Chat p95: 0.058ms (target: ≤5ms)
- Document p95 (1 MiB): 94ms (target: ≤100ms)
- Throughput: 10.3 MiB/s (target: ≥10 MiB/s)
- Peak RSS delta: 0.7 MiB (target: ≤64 MiB)
- 1,247 tests, 0 failures

### Features

- 5 transformation actions (redact, mask, remove, format-preserve, token-replace)
- Streaming with boundary buffering and context windows
- Restoration mode with numbered placeholders
- Idempotency (re-redacting is a no-op)
- Custom detector extension contract
- RFC 9457 Problem Details error serialization
- Unicode-aware grapheme cluster boundaries
- Configurable input limits (1 MiB default)
- AI-powered semantic confirmation via Jev (TypeSafe System One)
