# OpenTelemetry Redaction

Sensored provides OpenTelemetry processors that redact PII from traces and logs
**before** they are exported to your observability backend. This prevents
sensitive data from leaking into Datadog, New Relic, Dynatrace, Honeycomb, or
any other OTEL-compatible backend.

> **Scope:** The processors redact PII found in span names, span attributes,
> span events (names and attributes), span status messages, span link
> attributes, log bodies (string and structured), and log attributes.
> String values are redacted directly; non-string values (arrays, maps, nested
> objects) are recursively traversed via `redactValue`. Numeric and boolean
> primitives pass through unchanged.

## How it works

The processors wrap your existing export pipeline. They intercept spans and
log records just before export, redact any PII found in span names,
attributes, events, status messages, links, and log bodies, then forward the
cleaned record to the delegate processor.

```
Your app → OTEL SDK → SensoredSpanProcessor → BatchSpanProcessor → OTLP Export
```

PII is redacted before forwarding — the original span/log fields are never
sent to the backend. Non-string primitive values (numbers, booleans) pass
through unchanged; complex values (arrays, objects) are recursively redacted.

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
import { BatchSpanProcessor, NodeTracerProvider } from "@opentelemetry/sdk-trace-base";
import { Resource } from "@opentelemetry/resources";
import { trace } from "@opentelemetry/api";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

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

const tracerProvider = new NodeTracerProvider({
  spanProcessors: [spanProcessor],
  resource: new Resource({
    [ATTR_SERVICE_NAME]: "my-service",
  }),
});
trace.setGlobalTracerProvider(tracerProvider);
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
- **`excludeAttributes`** — Redact all attributes except these keys.

Non-string primitive attributes (numbers, booleans) pass through unchanged.
Arrays, maps, and nested objects are recursively traversed via `redactValue`.

## Log record processor

`SensoredLogRecordProcessor` wraps any `LogRecordProcessor` and redacts PII
from log bodies (string and structured) and attributes on `onEmit`:

```ts
import { SensoredLogRecordProcessor } from "@sensored/enterprise/otel/log-processor";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { Resource } from "@opentelemetry/resources";
import { logs } from "@opentelemetry/api";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

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

const loggerProvider = new LoggerProvider({
  logRecordProcessors: [logProcessor],
  resource: new Resource({
    [ATTR_SERVICE_NAME]: "my-service",
  }),
});
logs.setGlobalLoggerProvider(loggerProvider);
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
