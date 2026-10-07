# OpenTelemetry Redaction

Sensored provides OpenTelemetry processors that redact PII from traces and logs
**before** they are exported to your observability backend. This prevents
sensitive data from leaking into Datadog, New Relic, Dynatrace, Honeycomb, or
any other OTEL-compatible backend.

> **Scope:** The processors redact PII found in **string span names**, **string
> span attributes**, **string log bodies**, and **string log attributes**.
> Non-string fields (events, links, status messages, resources, arrays, nested
> objects, numeric/boolean attributes) are **not** scanned and may retain PII.

## How it works

The processors wrap your existing export pipeline. They intercept spans and
log records just before export, redact any PII found in string attributes,
span names, and log bodies, then forward the cleaned record to the delegate
processor.

```
Your app → OTEL SDK → SensoredSpanProcessor → BatchSpanProcessor → OTLP Export
```

PII is redacted before forwarding — the original span/log string fields are
never sent to the backend. Non-string fields pass through unchanged.

## Installation

```bash
bun add @sensored/enterprise @opentelemetry/api @opentelemetry/sdk-trace-base
```

For log redaction:

```bash
bun add @opentelemetry/sdk-logs
```

All `@opentelemetry/*` packages are optional peer deps — only install the ones
you use.

## Span processor

`SensoredSpanProcessor` wraps any `SpanProcessor` and redacts PII from span
attributes and span names on `onEnd`:

```ts
import { SensoredSpanProcessor } from "@sensored/enterprise/otel/span-processor";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

const spanProcessor = new SensoredSpanProcessor(
  new BatchSpanProcessor(otlpExporter),
  {
    redactorConfig: {
      rules: {
        email: { action: "redact" },
        phone: { action: "redact" },
        ssn: { action: "redact" },
      },
    },
  },
);

provider.addSpanProcessor(spanProcessor);
```

### Attribute filtering

By default, all string attributes are scanned for PII. Use `includeAttributes`
or `excludeAttributes` to narrow the scope:

```ts
const spanProcessor = new SensoredSpanProcessor(
  new BatchSpanProcessor(otlpExporter),
  {
    redactorConfig: {
      rules: { email: { action: "redact" } },
    },
    includeAttributes: ["http.request.body", "db.statement"],
  },
);
```

- **`includeAttributes`** — Only redact these attribute keys (takes precedence).
- **`excludeAttributes`** — Redact all string attributes except these keys.

Non-string attributes (numbers, booleans, arrays) pass through unchanged.

## Log record processor

`SensoredLogRecordProcessor` wraps any `LogRecordProcessor` and redacts PII
from log bodies and string attributes on `onEmit`:

```ts
import { SensoredLogRecordProcessor } from "@sensored/enterprise/otel/log-processor";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";

const logProcessor = new SensoredLogRecordProcessor(
  new BatchLogRecordProcessor(otlpLogExporter),
  {
    redactorConfig: {
      rules: {
        email: { action: "redact" },
        phone: { action: "redact" },
      },
    },
  },
);

loggerProvider.addLogRecordProcessor(logProcessor);
```

## RedactionConfig

Both processors accept the same `RedactionConfig`:

```ts
interface RedactionConfig {
  redactorConfig: RedactorConfig;
  includeAttributes?: readonly string[];
  excludeAttributes?: readonly string[];
}
```

The `redactorConfig` is a standard sensored `RedactorConfig` — the same one
you use for `createRedactor()`. This means all detectors, presets, custom
detectors, and rules work identically in the OTEL processors.

## Backend compatibility

Because the processors sit between the SDK and the exporter, they work with any
OTEL-compatible backend:

- **Datadog** — Use `@opentelemetry/exporter-otlp-http` or the Datadog OTLP
  endpoint.
- **New Relic** — Use the New Relic OTLP endpoint.
- **Dynatrace** — Use the Dynatrace OTLP ingest endpoint.
- **Honeycomb** — Use `OTLPMetricExporter` / `OTLPTraceExporter`.
- **Jaeger** — Use `OTLPTraceExporter` with Jaeger's OTLP receiver.
- **Grafana Tempo / Loki** — Use OTLP exporters for traces and logs.

No backend-specific configuration is needed — the processors are
backend-agnostic.
