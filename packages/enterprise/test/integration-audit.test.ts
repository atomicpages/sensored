import { describe, expect, test } from "bun:test";
import { CompositeAuditSink } from "@sensored/enterprise/audit/composite";
import { OtelAuditSink } from "@sensored/enterprise/audit/otel";
import { OtelMetricsSink } from "@sensored/enterprise/audit/otel-metrics";
import { createRedactor } from "sensored";

interface CapturedLogRecord {
  readonly severityNumber: number;
  readonly severityText: string;
  readonly body: string;
  readonly attributes: Record<string, string | number | boolean>;
}

function createMockLoggerProvider() {
  const records: CapturedLogRecord[] = [];

  return {
    records,
    getLogger() {
      return {
        emitLogRecord(record: CapturedLogRecord) {
          records.push(record);
        },
      };
    },
    forceFlush() {
      return Promise.resolve();
    },
    shutdown() {
      return Promise.resolve();
    },
  };
}

function createMockMeterProvider() {
  const increments: Array<{
    readonly value: number;
    readonly attributes: Record<string, string>;
  }> = [];

  return {
    increments,
    getMeter() {
      return {
        createCounter() {
          return {
            add(value: number, attributes?: Record<string, string>) {
              increments.push({ value, attributes: attributes ?? {} });
            },
          };
        },
      };
    },
    forceFlush() {
      return Promise.resolve();
    },
    shutdown() {
      return Promise.resolve();
    },
  };
}

describe("integration: sensored core + enterprise audit sinks", () => {
  test("OtelAuditSink receives events from redact()", () => {
    const provider = createMockLoggerProvider();
    const sink = new OtelAuditSink({ provider });

    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      auditSink: sink,
    });

    const result = redactor.redact("Contact alice@example.com today");

    expect(typeof result).toBe("string");
    expect(provider.records.length).toBe(1);
    expect(provider.records[0]?.attributes.ruleId).toBe("email");
    expect(provider.records[0]?.attributes.entityType).toBe("email");
    expect(provider.records[0]?.attributes.action).toBe("redact");
    expect(provider.records[0]?.attributes.start).toBe(8);
    expect(provider.records[0]?.attributes.end).toBe(25);
  });

  test("OtelAuditSink events never contain original PII", () => {
    const provider = createMockLoggerProvider();
    const sink = new OtelAuditSink({ provider });

    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      auditSink: sink,
    });

    redactor.redact("Contact alice@example.com today");

    const record = provider.records[0];
    const allAttrs = record ? Object.values(record.attributes).join(" ") : "";
    expect(allAttrs).not.toContain("alice@example.com");
    expect(record?.body).not.toContain("alice");
  });

  test("OtelMetricsSink increments counter from redact()", () => {
    const provider = createMockMeterProvider();
    const sink = new OtelMetricsSink({ provider });

    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      auditSink: sink,
    });

    redactor.redact("alice@example.com and bob@test.org");

    expect(provider.increments.length).toBe(2);
    expect(provider.increments[0]?.value).toBe(1);
    expect(provider.increments[0]?.attributes.entityType).toBe("email");
    expect(provider.increments[0]?.attributes.action).toBe("redact");
  });

  test("CompositeAuditSink fans out to both sinks", () => {
    const logProvider = createMockLoggerProvider();
    const metricProvider = createMockMeterProvider();

    const sink = new CompositeAuditSink({
      sinks: [
        new OtelAuditSink({ provider: logProvider }),
        new OtelMetricsSink({ provider: metricProvider }),
      ],
    });

    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      auditSink: sink,
    });

    redactor.redact("alice@example.com");

    expect(logProvider.records.length).toBe(1);
    expect(metricProvider.increments.length).toBe(1);
  });

  test("CompositeAuditSink continues if one sink throws", () => {
    const metricProvider = createMockMeterProvider();

    const failingSink = {
      write() {
        throw new Error("sink failed");
      },
    };

    const sink = new CompositeAuditSink({
      sinks: [failingSink, new OtelMetricsSink({ provider: metricProvider })],
    });

    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      auditSink: sink,
    });

    redactor.redact("alice@example.com");

    expect(metricProvider.increments.length).toBe(1);
  });

  test("multiple PII types emit separate events", () => {
    const provider = createMockLoggerProvider();
    const sink = new OtelAuditSink({ provider });

    const redactor = createRedactor({
      presets: ["pii"],
      rules: {
        email: { action: "redact" },
        phone: { action: "redact" },
      },
      auditSink: sink,
    });

    redactor.redact("Email: alice@example.com, Phone: 555-123-4567");

    expect(provider.records.length).toBeGreaterThanOrEqual(2);

    const entityTypes = provider.records.map((r) => r.attributes.entityType);
    expect(entityTypes).toContain("email");
  });

  test("audit sink works with mask action", () => {
    const provider = createMockLoggerProvider();
    const sink = new OtelAuditSink({ provider });

    const redactor = createRedactor({
      rules: { email: { action: "mask" } },
      auditSink: sink,
    });

    redactor.redact("alice@example.com");

    expect(provider.records.length).toBe(1);
    expect(provider.records[0]?.attributes.action).toBe("mask");
  });

  test("audit sink works with remove action", () => {
    const provider = createMockLoggerProvider();
    const sink = new OtelAuditSink({ provider });

    const redactor = createRedactor({
      rules: { email: { action: "remove" } },
      auditSink: sink,
    });

    redactor.redact("Contact alice@example.com now");

    expect(provider.records.length).toBe(1);
    expect(provider.records[0]?.attributes.action).toBe("remove");
  });

  test("reasons are populated in audit events", () => {
    const provider = createMockLoggerProvider();
    const sink = new OtelAuditSink({ provider });

    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      auditSink: sink,
    });

    redactor.redact("alice@example.com");

    const record = provider.records[0];
    expect(record).toBeDefined();
    const reasons = record?.attributes.reasons;
    expect(typeof reasons).toBe("string");
    const parsed = JSON.parse(reasons as string);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  test("timestamp is a valid epoch millis number", () => {
    const provider = createMockLoggerProvider();
    const sink = new OtelAuditSink({ provider });

    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      auditSink: sink,
    });

    const before = Date.now();
    redactor.redact("alice@example.com");
    const after = Date.now();

    const ts = provider.records[0]?.attributes.timestamp;
    expect(typeof ts).toBe("number");
    expect(ts as number).toBeGreaterThanOrEqual(before);
    expect(ts as number).toBeLessThanOrEqual(after);
  });
});
