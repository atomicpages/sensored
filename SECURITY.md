# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in sensored, please report it
responsibly. Do NOT open a public GitHub issue.

Email: security@sensored.dev

Include:

- A description of the vulnerability and its impact
- Steps to reproduce or a proof-of-concept
- Affected versions, if known

You will receive a response within 72 hours. We request that you do not disclose
the vulnerability publicly until a fix has been released.

## Threat Model

### What sensored Is

sensored is a **deterministic text-redaction library**. It scans input text for
PII patterns (emails, phone numbers, SSNs, payment cards, API keys, etc.) and
replaces them with placeholders, masks, or deterministic fake values. It is a
pure library with no HTTP server, no database, and no network calls.

### What sensored Is Not

sensored is **not** an encryption library. It does not encrypt, hash
(cryptographically), or otherwise protect PII at rest. The restoration feature
stores plaintext placeholder → original mappings in memory. Callers are
responsible for protecting any restoration maps they produce.

### Assets

| Asset           | Description                                              |
| --------------- | -------------------------------------------------------- |
| Input text      | Caller-supplied text that may contain PII                |
| Restoration map | Plaintext mapping of placeholders to original PII values |
| Output text     | Redacted text with PII replaced                          |
| Configuration   | Rule sets, detector definitions, custom presets          |

### Threats and Mitigations

#### 1. PII Leakage via Error Messages

**Threat:** Error messages could contain original PII from input text.

**Mitigation:** All error messages are static strings defined in
`src/errors.ts`. No caller-supplied values are interpolated into error messages.
Custom detector validator throws are caught and converted to `DETECTOR_CONTRACT`
errors with static messages (`src/detectors/base.ts:355-368`).

#### 2. ReDoS (Regular Expression Denial of Service)

**Threat:** Malicious input could trigger catastrophic backtracking in detector
regex patterns, causing CPU exhaustion.

**Mitigation:** All regex patterns use bounded quantifiers and avoid ambiguous
nested repetition. Patterns are reviewed during detector onboarding. Input
length is capped at 1 MiB (`src/index.ts:38`); stream buffer is capped at 65,536
UTF-16 units (`src/stream.ts:16`).

#### 3. Prototype Pollution

**Threat:** Malicious configuration objects could pollute `Object.prototype` and
alter library behavior.

**Mitigation:** No direct prototype access anywhere in the codebase. All objects
are created fresh (`{}`, `Object.fromEntries()`, `Object.freeze()`). The
`isRecord()` guard rejects non-plain objects. `Object.keys()` does not enumerate
prototype properties.

#### 4. Dynamic Code Execution

**Threat:** `eval()` or `new Function()` could execute attacker-supplied code.

**Mitigation:** No `eval()`, `new Function()`, or `Function()` calls exist
anywhere in the codebase. The optional `compromise` NER dependency is loaded via
`require()` inside a try/catch — it is a trusted npm package, not user supplied
code.

#### 5. Supply Chain Compromise

**Threat:** A dependency could be compromised to inject malicious code.

**Mitigation:**

- All GitHub Actions are SHA-pinned with version comments
- `bun install --frozen-lockfile` in CI prevents lockfile drift
- `bun pm scan` runs in CI to detect known vulnerabilities
- `@types/bun` is pinned to a specific version (not `latest`)
- Bun version is pinned in CI setup

#### 6. Restoration Map Exposure

**Threat:** The restoration map contains plaintext PII and could be logged,
serialized, or transmitted insecurely.

**Mitigation:** The map is frozen via `Object.freeze()` to prevent mutation.
Callers are documented (in `src/CONTEXT.md`) that the map contains plaintext PII
and must be treated as sensitive. JavaScript strings are immutable and cannot be
securely zeroed — this is a platform limitation.

#### 7. Post-Registration Detector Mutation

**Threat:** A detector's regex or configuration could be mutated after
registration to alter detection behavior.

**Mitigation:** Custom detector regex is snapshotted via `new RegExp()` with
stripped `g`/`y` flags (`src/detectors/base.ts:327-330`). Rule settings are
deep-frozen after validation (`src/policy.ts:18-34`). The policy object is
frozen.

#### 8. Unbounded Memory Consumption

**Threat:** Extremely large inputs could exhaust memory.

**Mitigation:** Complete-string input is capped at `MAX_INPUT_LENGTH` (1 MiB,
configurable). Stream buffer is capped at 65,536 UTF-16 units. Both limits throw
typed errors when exceeded.

### Out of Scope

- **Caller-side PII handling:** How callers store, transmit, or dispose of
  redacted text and restoration maps is the caller's responsibility.
- **JavaScript memory security:** JavaScript strings are immutable and cannot be
  securely zeroed. This is a platform limitation, not a library defect.
- **Custom detector code:** Custom detector validators are user-supplied
  callbacks executed synchronously. The library trusts this code by design
  (documented in `src/CONTEXT.md`): "Custom synchronous code is trusted and
  cannot be interrupted."
- **Transport security:** sensored has no network component. TLS, certificate
  validation, etc. are caller concerns.

## Dependency Security

- **Runtime:** This is a library with zero runtime dependencies (peer dependency
  on `compromise` is optional).
- **Dev dependencies:** Pinned in `bun.lock`; CI uses `--frozen-lockfile`.
- **Security scanning:** `bun pm scan` runs in CI on every push and PR.
- **Reporting vulnerable dependencies:** Use the same contact above.
