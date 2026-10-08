# Enterprise package

Commercial `@sensored/enterprise` — cloud KMS vault providers for sensored.
Ships on npm under a commercial EULA (not MIT). Honor-system 30-day trial. No
runtime gates; enforcement is legal only.

## Module structure

```
src/
  index.ts                        Barrel exports
  providers/
    base.ts                       BaseKmsProvider<T> abstract base class
    aws-kms.ts                    AwsKmsProvider
    gcp-kms.ts                    GcpKmsProvider
    azure-key-vault.ts            AzureKeyVaultProvider
    hashicorp-vault.ts            HashiCorpVaultProvider
    workos-ekm.ts                 WorkOsEkmProvider
  audit/
    otel-sink.ts                  OpenTelemetry audit sink
    otel-metrics-sink.ts          OpenTelemetry metrics audit sink
    composite-sink.ts             Composite audit sink
  langfuse/
    mask-adapter.ts               createLangfuseMaskFunction — LangFuse maskInput adapter
  otel/
    redaction-utils.ts            Shared redaction utilities (RedactionConfig, redactValue, etc.)
    span-processor.ts             SensoredSpanProcessor — delegating SpanProcessor with PII redaction
    log-processor.ts              SensoredLogRecordProcessor — delegating LogRecordProcessor with PII redaction
```

## Design

### BaseKmsProvider<T>

Abstract base class implementing `VaultProvider` from `sensored/vault`. Generic
`T` is the cloud SDK client type — eliminates `client: unknown`.

Template method pattern: providers implement `encryptRaw()` / `decryptRaw()`
(protected abstract). The base class provides concrete `encrypt()` / `decrypt()`
that wrap calls in try/catch and rethrow non-`VaultError` exceptions as
`VaultError` with appropriate codes (`VAULT_ENCRYPT_FAILED`,
`VAULT_DECRYPT_FAILED`).

Provides:

- `getClient()` — lazy init via abstract `createClient()`, caches client
- `encrypt()` / `decrypt()` — concrete, wrap `encryptRaw()` / `decryptRaw()`
- `generateDataKey()` — generates 32-byte DEK locally, encrypts via `encrypt()`
- `decryptDataKey()` — delegates to `decrypt()`

Providers override `generateDataKey()` / `decryptDataKey()` only when the cloud
KMS has a native data-key API (AWS KMS `GenerateDataKey`). AWS overrides include
their own try/catch wrapping with `VAULT_DEK_GENERATION_FAILED` /
`VAULT_DEK_DECRYPT_FAILED` codes.

Each provider defines a minimal client interface matching the SDK methods it
uses. SDKs are lazy-loaded via `await import()` with no hard dependencies. All
cloud SDKs are optional peer deps.

### Providers

- **AwsKmsProvider** — overrides `generateDataKey()` and `decryptDataKey()` to
  use native KMS `GenerateDataKey` API. Options: `keyId`, `region`, `endpoint`
  (for VPC endpoints or local testing with fakecloud), `credentials`.
- **GcpKmsProvider** — uses base defaults. Options: `keyName`,
  `credentialsJson`.
- **AzureKeyVaultProvider** — uses base defaults. Options: `vaultUrl`,
  `keyName`, `credential`.
- **HashiCorpVaultProvider** — uses base defaults. Stores `vaultUrl` and `token`
  as separate fields (not packed into client). Options: `vaultUrl`, `token`,
  `keyName`, `mountPath`.
- **WorkOsEkmProvider** — uses base defaults. Options: `apiKey`, `ekmId`,
  `keyId`.

### Audit sinks

`audit/otel-sink.ts` exports `OtelAuditSink` — implements `AuditSink` from
sensored. Constructor accepts a duck-typed `LoggerProviderLike` (minimal
interface, not the full OTEL SDK type). `write()` emits a log record with
severity 9 (INFO), all `AuditEvent` fields as attributes, and optional trace
correlation (traceId, spanId) from `@opentelemetry/api` if available.
`flush()` calls `provider.forceFlush()` and `close()` calls
`provider.shutdown()`; both return `Promise<void>`.

`audit/otel-metrics-sink.ts` exports `OtelMetricsSink` — implements `AuditSink`.
Constructor accepts a duck-typed `MeterProviderLike`. Creates a counter
(`sensored.detections`) incremented per event with entityType, action, and
ruleId attributes. `flush()` / `close()` delegate to the provider and return
`Promise<void>`.

`audit/composite-sink.ts` exports `CompositeAuditSink` — fans out events to
multiple `AuditSink` instances. `write()` errors per-sink are caught so one
failing sink doesn't stop others. `flush()` / `close()` use `Promise.all`
with individual `.catch()` to swallow rejections from individual sinks; both
return `Promise<void>`.

All OTEL types are duck-typed minimal interfaces. `@opentelemetry/api` is an
optional peer dep used only for trace correlation in `OtelAuditSink`.

### LangFuse mask adapter

`langfuse/mask-adapter.ts` exports `createLangfuseMaskFunction(config)` —
accepts a `RedactorConfig` from sensored, creates a redactor, and returns a
`(input: { data: unknown }) => string` function suitable for LangFuse's
`maskInput` option. String data is redacted directly; non-string data is
recursively redacted via `redactValue` then `JSON.stringify`-d. The redactor
is created once and reused across calls.

### OpenTelemetry redaction processors

`otel/redaction-utils.ts` exports `RedactionConfig` (wraps `RedactorConfig`
with optional `includeAttributes` / `excludeAttributes` filters), plus
`shouldRedactAttribute()`, `redactAttributes()`, and
`cloneWithOverrides()` helpers used by both processors. `redactAttributes`
redacts string values via `redactor.redact()` and non-string values via
`redactValue` (recursive traversal). `cloneWithOverrides()` creates a shallow
clone of an object with prototype preservation via
`Object.create(Object.getPrototypeOf(obj))`, applying override properties on
top. Exported from `redaction-utils.ts` but NOT from the enterprise barrel —
internal helper.

`otel/span-processor.ts` exports `SensoredSpanProcessor` — a delegating
`SpanProcessor` that redacts span name, attributes, event names, event
attributes, status message, and link attributes on `onEnd` before forwarding
to the wrapped processor. `onStart` passes through unchanged.

`otel/log-processor.ts` exports `SensoredLogRecordProcessor` — a delegating
`LogRecordProcessor` that redacts log body (string and structured) and
attributes on `onEmit` before forwarding to the wrapped processor. Non-string
bodies are recursively redacted via `redactValue`.

Both processors create a redactor once at construction time and reuse it.
All `@opentelemetry/*` packages are optional peer deps.

## Dependencies

`sensored/vault` is the only hard dependency (workspace link). All cloud SDKs
are optional peer deps, lazy-loaded at runtime. All `@opentelemetry/*`
packages are optional peer deps.
