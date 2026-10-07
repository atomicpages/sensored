# Audit Events

Sensored can emit structured audit events for every PII detection, giving you a
compliance trail without exposing the original sensitive values.

## How it works

When you configure an `auditSink` on your `RedactorConfig`, sensored emits one
`AuditEvent` per detection after redaction completes. Each event contains only
metadata — the rule that fired, the entity type, the action taken, the match
position, and the replacement. The original PII value is **never** included.

```ts
import type { AuditEvent, AuditSink } from "sensored";

const consoleSink: AuditSink = {
  write(event: AuditEvent) {
    console.log(JSON.stringify(event));
  },
};

const redactor = createRedactor({
  rules: { email: { action: "redact" } },
  auditSink: consoleSink,
});

redactor.redact("Contact alice@example.com");
// Console: {"ruleId":"email","entityType":"email","action":"redact",
//   "reasons":["email.ascii_dot_atom","email.dns_domain"],
//   "start":9,"end":27,"replacement":"[REDACTED]","timestamp":1712345678901}
```

## AuditEvent interface

```ts
interface AuditEvent {
  readonly ruleId: string;
  readonly entityType: string;
  readonly action: "redact" | "mask" | "format-preserve" | "token-replace" | "remove";
  readonly reasons: readonly string[];
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
  readonly timestamp: number;
}
```

- **`ruleId`** — The detector rule that matched (e.g. `"email"`, `"ssn"`).
- **`entityType`** — The entity category (e.g. `"email"`, `"phone"`).
- **`action`** — The winning action for the detection group.
- **`reasons`** — Why the detector matched (detector-specific reason codes).
- **`start` / `end`** — Character offsets of the match in the original text.
- **`replacement`** — The replacement text that was substituted.
- **`timestamp`** — Unix epoch milliseconds.

## AuditSink interface

```ts
interface AuditSink {
  write(event: AuditEvent): void;
  flush?(): void;
  close?(): void;
}
```

- **`write()`** — Synchronous fire-and-forget. Buffer internally if you need
  batching.
- **`flush()`** — Optional. Flush any buffered events to the backend.
- **`close()`** — Optional. Release resources (connections, file handles).

Sink errors are swallowed by the pipeline — audit logging never breaks
redaction.

## Using audit sinks with streaming

Audit sinks work with streaming redaction too. Pass `auditSink` in
`StreamOptions`:

```ts
import { stream } from "sensored";

for await (const chunk of stream(text, {
  rules: { email: { action: "redact" } },
  auditSink: consoleSink,
})) {
  process.stdout.write(chunk);
}
```

Stream offsets are absolute (relative to the full input), not per-chunk.

## Forcing report

When an `auditSink` is configured, sensored automatically forces `report: true`
internally so inspection groups are always populated. You don't need to set
`report` yourself — the redacted output text is identical either way.

## Enterprise audit sinks

The `@sensored/enterprise` package provides production-ready sinks:

- **`OtelAuditSink`** — Emits events as OpenTelemetry log records with trace
  correlation.
- **`OtelMetricsSink`** — Increments OTEL counters per detection.
- **`CompositeAuditSink`** — Fans out to multiple sinks.

See the [OTEL Audit Sinks](../enterprise/otel-audit-sinks) guide for details.
