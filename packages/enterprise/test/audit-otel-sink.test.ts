import { describe, expect, it, mock } from "bun:test";
import type { AuditEvent } from "sensored";
import {
  type LoggerLike,
  type LoggerProviderLike,
  OtelAuditSink,
} from "../src/audit/otel-sink";

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    ruleId: "email",
    entityType: "email",
    action: "redact",
    reasons: ["email.pattern"],
    start: 0,
    end: 10,
    replacement: "[EMAIL_1]",
    timestamp: 1700000000000,
    ...overrides,
  };
}

class MockLogger implements LoggerLike {
  records: Parameters<LoggerLike["emit"]>[0][] = [];

  emit(record: Parameters<LoggerLike["emit"]>[0]): void {
    this.records.push(record);
  }
}

class MockLoggerProvider implements LoggerProviderLike {
  logger: MockLogger;
  forceFlushCalls = 0;
  shutdownCalls = 0;

  constructor() {
    this.logger = new MockLogger();
  }

  getLogger(): MockLogger {
    return this.logger;
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

class MinimalProvider implements LoggerProviderLike {
  logger: MockLogger;

  constructor() {
    this.logger = new MockLogger();
  }

  getLogger(): MockLogger {
    return this.logger;
  }
}

describe("OtelAuditSink", () => {
  describe("write", () => {
    it("emits a log record with correct severity and body", () => {
      const provider = new MockLoggerProvider();
      const sink = new OtelAuditSink({ provider });

      sink.write(makeEvent());

      expect(provider.logger.records).toHaveLength(1);

      const record = provider.logger.records[0];

      expect(record.severityNumber).toBe(9);
      expect(record.severityText).toBe("INFO");
      expect(record.body).toBe("sensored.audit");
    });

    it("maps all AuditEvent fields to attributes", () => {
      const provider = new MockLoggerProvider();
      const sink = new OtelAuditSink({ provider });
      const event = makeEvent({
        ruleId: "ssn",
        entityType: "ssn",
        action: "mask",
        reasons: ["ssn.pattern", "ssn.context"],
        start: 5,
        end: 14,
        replacement: "***-**-****",
        timestamp: 1700000001234,
      });

      sink.write(event);

      const attrs = provider.logger.records[0].attributes;

      expect(attrs).toBeDefined();

      if (attrs) {
        expect(attrs.ruleId).toBe("ssn");
        expect(attrs.entityType).toBe("ssn");
        expect(attrs.action).toBe("mask");
        expect(attrs.reasons).toBe(
          JSON.stringify(["ssn.pattern", "ssn.context"]),
        );
        expect(attrs.start).toBe(5);
        expect(attrs.end).toBe(14);
        expect(attrs.replacement).toBe("***-**-****");
        expect(attrs.timestamp).toBe(1700000001234);
      }
    });

    it("serializes reasons array as JSON string", () => {
      const provider = new MockLoggerProvider();
      const sink = new OtelAuditSink({ provider });

      sink.write(makeEvent({ reasons: ["a", "b", "c"] }));

      const attrs = provider.logger.records[0].attributes;

      expect(attrs?.reasons).toBe(JSON.stringify(["a", "b", "c"]));
    });

    it("uses custom logger name and version when provided", () => {
      const getLogger = mock(() => new MockLogger());
      const provider: LoggerProviderLike = { getLogger };
      const sink = new OtelAuditSink({
        provider,
        loggerName: "custom.audit",
        loggerVersion: "2.0.0",
      });

      sink.write(makeEvent());

      expect(getLogger).toHaveBeenCalledWith("custom.audit", "2.0.0");
    });

    it("uses default logger name and version when not provided", () => {
      const getLogger = mock(() => new MockLogger());
      const provider: LoggerProviderLike = { getLogger };
      const sink = new OtelAuditSink({ provider });

      sink.write(makeEvent());

      expect(getLogger).toHaveBeenCalledWith("sensored.audit", "1.0.0");
    });
  });

  describe("flush", () => {
    it("calls provider.forceFlush when it exists", async () => {
      const provider = new MockLoggerProvider();
      const sink = new OtelAuditSink({ provider });

      await sink.flush();

      expect(provider.forceFlushCalls).toBe(1);
    });

    it("does not throw when provider.forceFlush is missing", async () => {
      const provider = new MinimalProvider();
      const sink = new OtelAuditSink({ provider });

      await expect(sink.flush()).resolves.toBeUndefined();
    });
  });

  describe("close", () => {
    it("calls provider.shutdown when it exists", async () => {
      const provider = new MockLoggerProvider();
      const sink = new OtelAuditSink({ provider });

      await sink.close();

      expect(provider.shutdownCalls).toBe(1);
    });

    it("does not throw when provider.shutdown is missing", async () => {
      const provider = new MinimalProvider();
      const sink = new OtelAuditSink({ provider });

      await expect(sink.close()).resolves.toBeUndefined();
    });
  });

  describe("multiple writes", () => {
    it("emits one record per write call", () => {
      const provider = new MockLoggerProvider();
      const sink = new OtelAuditSink({ provider });

      sink.write(makeEvent());
      sink.write(makeEvent());
      sink.write(makeEvent());

      expect(provider.logger.records).toHaveLength(3);
    });
  });
});
