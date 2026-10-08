import { describe, expect, it } from "bun:test";
import type { RedactorConfig } from "sensored";
import {
  type RedactionConfig,
  SensoredLogRecordProcessor,
} from "../src/otel/log-processor";

const testRedactorConfig: RedactorConfig = {
  rules: {
    email: { action: "redact" },
    phone: { action: "redact" },
  },
};

interface MockLogRecord {
  body?: unknown;
  attributes: Record<string, unknown>;
  [key: string]: unknown;
}

class MockLogRecordProcessor {
  onEmitCalls: { logRecord: unknown; context: unknown }[] = [];
  forceFlushCalls = 0;
  shutdownCalls = 0;

  onEmit(logRecord: unknown, context?: unknown): void {
    this.onEmitCalls.push({ logRecord, context });
  }

  forceFlush(): Promise<void> {
    this.forceFlushCalls++;

    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    this.shutdownCalls++;

    return Promise.resolve();
  }
}

describe("SensoredLogRecordProcessor", () => {
  it("redacts string body and string attributes on onEmit", () => {
    const mock = new MockLogRecordProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredLogRecordProcessor(
      mock as unknown as MockLogRecordProcessor,
      config,
    );

    const logRecord: MockLogRecord = {
      body: "contact admin@example.com for help",
      attributes: {
        email: "user@example.com",
        count: 42,
        active: true,
      },
    };

    processor.onEmit(logRecord as unknown as MockLogRecord);

    expect(mock.onEmitCalls.length).toBe(1);

    const redacted = mock.onEmitCalls[0].logRecord as MockLogRecord;

    expect(redacted.body).not.toContain("admin@example.com");
    expect(redacted.attributes.email).not.toContain("user@example.com");
    expect(redacted.attributes.count).toBe(42);
    expect(redacted.attributes.active).toBe(true);
  });

  it("does not mutate the original log record", () => {
    const mock = new MockLogRecordProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredLogRecordProcessor(
      mock as unknown as MockLogRecordProcessor,
      config,
    );

    const logRecord: MockLogRecord = {
      body: "contact admin@example.com",
      attributes: { email: "user@example.com" },
    };

    processor.onEmit(logRecord as unknown as MockLogRecord);

    expect(logRecord.body).toBe("contact admin@example.com");
    expect(logRecord.attributes.email).toBe("user@example.com");
  });

  it("passes non-string body through unchanged", () => {
    const mock = new MockLogRecordProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredLogRecordProcessor(
      mock as unknown as MockLogRecordProcessor,
      config,
    );

    const logRecord: MockLogRecord = {
      body: 42,
      attributes: {},
    };

    processor.onEmit(logRecord as unknown as MockLogRecord);

    const redacted = mock.onEmitCalls[0].logRecord as MockLogRecord;

    expect(redacted.body).toBe(42);
  });

  it("redacts structured (object) body recursively", () => {
    const mock = new MockLogRecordProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredLogRecordProcessor(
      mock as unknown as MockLogRecordProcessor,
      config,
    );

    const logRecord: MockLogRecord = {
      body: { email: "user@example.com", nested: { phone: "+1-555-123-4567" } },
      attributes: {},
    };

    processor.onEmit(logRecord as unknown as MockLogRecord);

    const redacted = mock.onEmitCalls[0].logRecord as MockLogRecord;
    const body = redacted.body as Record<string, unknown>;
    const nested = body.nested as Record<string, unknown>;

    expect(body.email).not.toContain("user@example.com");
    expect(nested.phone).not.toContain("+1-555-123-4567");
  });

  it("redacts array body recursively", () => {
    const mock = new MockLogRecordProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredLogRecordProcessor(
      mock as unknown as MockLogRecordProcessor,
      config,
    );

    const logRecord: MockLogRecord = {
      body: ["contact admin@example.com", "no PII here"],
      attributes: {},
    };

    processor.onEmit(logRecord as unknown as MockLogRecord);

    const redacted = mock.onEmitCalls[0].logRecord as MockLogRecord;
    const body = redacted.body as unknown[];

    expect(body[0]).not.toContain("admin@example.com");
    expect(body[1]).toBe("no PII here");
  });

  it("does not mutate original structured body", () => {
    const mock = new MockLogRecordProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredLogRecordProcessor(
      mock as unknown as MockLogRecordProcessor,
      config,
    );

    const logRecord: MockLogRecord = {
      body: { email: "user@example.com" },
      attributes: {},
    };

    processor.onEmit(logRecord as unknown as MockLogRecord);

    const body = logRecord.body as Record<string, unknown>;

    expect(body.email).toBe("user@example.com");
  });

  it("passes undefined body through unchanged", () => {
    const mock = new MockLogRecordProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredLogRecordProcessor(
      mock as unknown as MockLogRecordProcessor,
      config,
    );

    const logRecord: MockLogRecord = {
      attributes: {},
    };

    processor.onEmit(logRecord as unknown as MockLogRecord);

    const redacted = mock.onEmitCalls[0].logRecord as MockLogRecord;

    expect(redacted.body).toBeUndefined();
  });

  it("respects includeAttributes", () => {
    const mock = new MockLogRecordProcessor();
    const config: RedactionConfig = {
      redactorConfig: testRedactorConfig,
      includeAttributes: ["email"],
    };

    const processor = new SensoredLogRecordProcessor(
      mock as unknown as MockLogRecordProcessor,
      config,
    );

    const logRecord: MockLogRecord = {
      body: "test",
      attributes: {
        email: "user@example.com",
        phone: "+1-555-123-4567",
      },
    };

    processor.onEmit(logRecord as unknown as MockLogRecord);

    const redacted = mock.onEmitCalls[0].logRecord as MockLogRecord;

    expect(redacted.attributes.email).not.toContain("user@example.com");
    expect(redacted.attributes.phone).toBe("+1-555-123-4567");
  });

  it("respects excludeAttributes", () => {
    const mock = new MockLogRecordProcessor();
    const config: RedactionConfig = {
      redactorConfig: testRedactorConfig,
      excludeAttributes: ["phone"],
    };

    const processor = new SensoredLogRecordProcessor(
      mock as unknown as MockLogRecordProcessor,
      config,
    );

    const logRecord: MockLogRecord = {
      body: "test",
      attributes: {
        email: "user@example.com",
        phone: "+1-555-123-4567",
      },
    };

    processor.onEmit(logRecord as unknown as MockLogRecord);

    const redacted = mock.onEmitCalls[0].logRecord as MockLogRecord;

    expect(redacted.attributes.email).not.toContain("user@example.com");
    expect(redacted.attributes.phone).toBe("+1-555-123-4567");
  });

  it("passes context through to delegate", () => {
    const mock = new MockLogRecordProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredLogRecordProcessor(
      mock as unknown as MockLogRecordProcessor,
      config,
    );

    const logRecord: MockLogRecord = {
      body: "test",
      attributes: {},
    };

    const ctx = { traceId: "abc" };

    processor.onEmit(logRecord as unknown as MockLogRecord, ctx as unknown);

    expect(mock.onEmitCalls[0].context).toBe(ctx);
  });

  it("delegates forceFlush", async () => {
    const mock = new MockLogRecordProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredLogRecordProcessor(
      mock as unknown as MockLogRecordProcessor,
      config,
    );

    await processor.forceFlush();

    expect(mock.forceFlushCalls).toBe(1);
  });

  it("delegates shutdown", async () => {
    const mock = new MockLogRecordProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredLogRecordProcessor(
      mock as unknown as MockLogRecordProcessor,
      config,
    );

    await processor.shutdown();

    expect(mock.shutdownCalls).toBe(1);
  });
});
