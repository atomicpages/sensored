# Enterprise Overview

The `@sensored/enterprise` package provides production-ready integrations for
teams that need cloud KMS vault providers, OpenTelemetry redaction processors,
audit sinks, and LLM observability adapters.

## License

`@sensored/enterprise` ships under a commercial EULA — not the MIT license that
covers the core `sensored` package. A 30-day evaluation period is granted for
trial purposes. Continued use beyond 30 days without a valid license is a
violation of the EULA and may result in legal action. There are no runtime
gates or license keys. The terms of the enterprise package may change at any
time without notice.

## What's included

| Feature | Module | Description |
| --- | --- | --- |
| Cloud KMS Providers | `@sensored/enterprise` | AWS KMS, GCP KMS, Azure Key Vault, HashiCorp Vault, WorkOS EKM |
| OTEL Span Processor | `@sensored/enterprise/otel/span-processor` | Redacts PII from traces before export |
| OTEL Log Processor | `@sensored/enterprise/otel/log-processor` | Redacts PII from log bodies and attributes before export |
| OTEL Audit Sink | `@sensored/enterprise/audit/otel` | Emits audit events as OTEL log records with trace correlation |
| OTEL Metrics Sink | `@sensored/enterprise/audit/otel-metrics` | Emits audit events as OTEL counter metrics |
| Composite Audit Sink | `@sensored/enterprise/audit/composite` | Fans out to multiple sinks |
| LangFuse Mask Adapter | `@sensored/enterprise/langfuse/mask` | Redacts PII before data reaches LangFuse |

## Installation

```bash
bun add @sensored/enterprise
```

All cloud SDKs and `@opentelemetry/*` packages are optional peer deps — install
only the ones you use.

## Next steps

- [Cloud KMS Providers](./cloud-kms-providers) — Encrypted vault with cloud-managed keys
- [OTEL Redaction Processors](./otel-redaction) — Scrub PII from traces and logs
- [OTEL Audit Sinks](./otel-audit-sinks) — Emit detection events as OTEL logs and metrics
- [LangFuse Integration](./langfuse) — Redact PII before LangFuse stores data
