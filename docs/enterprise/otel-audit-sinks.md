# OTEL Audit Sinks

The `@sensored/enterprise` package provides OpenTelemetry audit sinks that
emit detection events to your observability backend as log records or metrics.

## OtelAuditSink

`OtelAuditSink` emits each `AuditEvent` as an OTEL log record with trace
correlation. This gives you a searchable audit trail of PII detections in your
log backend.

### Installation

```bash
bun add @sensored/enterprise @opentelemetry/api
```

### Setup

```ts
import { OtelAuditSink } from "@sensored/enterprise/audit/otel";
import { createRedactor } from "sensored";
import { LoggerProvider } from "@opentelemetry/sdk-logs";

const loggerProvider = new LoggerProvider({
  processors: [new BatchLogRecordProcessor(otlpLogExporter)],
});

const auditSink = new OtelAuditSink({
  provider: loggerProvider,
});

const redactor = createRedactor({
  rules: { email: { action: "redact" } },
  auditSink,
});

redactor.redact("Contact alice@example.com");
// Log record emitted with severity 9 (INFO)
// Attributes: ruleId, entityType, action, reasons, start, end, replacement, timestamp
```

### Trace correlation

When a span is active, `OtelAuditSink` automatically attaches `traceId` and
`spanId` to each log record via `@opentelemetry/api`. This lets you correlate
PII detections with the request that triggered them.

## OtelMetricsSink

`OtelMetricsSink` increments an OTEL counter per detection, giving you
dashboards and alerts for PII detections in your metrics backend.

### Setup

```ts
import { OtelMetricsSink } from "@sensored/enterprise/audit/otel-metrics";
import { createRedactor } from "sensored";
import { MeterProvider } from "@opentelemetry/sdk-metrics";

const meterProvider = new MeterProvider({
  readers: [otlpMetricReader],
});

const metricsSink = new OtelMetricsSink({
  provider: meterProvider,
});

const redactor = createRedactor({
  rules: { email: { action: "redact" } },
  auditSink: metricsSink,
});

redactor.redact("Contact alice@example.com");
// Counter "sensored.detections" incremented by 1
// Attributes: { entityType: "email", action: "redact", ruleId: "email" }
```

### Metrics emitted

| Metric | Type | Description | Attributes |
|--------|------|-------------|------------|
| `sensored.detections` | Counter | Count of PII detections | `entityType`, `action`, `ruleId` |

## CompositeAuditSink

Use `CompositeAuditSink` to send events to multiple sinks simultaneously:

```ts
import { OtelAuditSink } from "@sensored/enterprise/audit/otel";
import { OtelMetricsSink } from "@sensored/enterprise/audit/otel-metrics";
import { CompositeAuditSink } from "@sensored/enterprise/audit/composite";

const compositeSink = new CompositeAuditSink({
  sinks: [
    new OtelAuditSink({ provider: loggerProvider }),
    new OtelMetricsSink({ provider: meterProvider }),
  ],
});

const redactor = createRedactor({
  rules: { email: { action: "redact" } },
  auditSink: compositeSink,
});
```

Errors in individual sinks are caught — one failing sink doesn't affect others.

## Duck-typed providers

All sinks accept duck-typed minimal interfaces, not the full OTEL SDK types.
This means you can pass any provider that implements the minimal interface:

```ts
interface LoggerProviderLike {
  getLogger(name: string, version?: string): LoggerLike;
  forceFlush?(): Promise<void>;
  shutdown?(): Promise<void>;
}

interface MeterProviderLike {
  getMeter(name: string, version?: string): MeterLike;
  forceFlush?(): Promise<void>;
  shutdown?(): Promise<void>;
}
```

No hard dependency on any specific OTEL SDK version.
