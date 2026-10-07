import { describe, expect, it, mock } from "bun:test";
import type { AuditEvent } from "sensored";
import {
  type CounterLike,
  type MeterLike,
  type MeterProviderLike,
  OtelMetricsSink,
} from "../src/audit/otel-metrics-sink";

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

class MockCounter implements CounterLike {
  calls: { value: number; attributes?: Record<string, string> }[] = [];

  add(value: number, attributes?: Record<string, string>): void {
    this.calls.push({ value, attributes });
  }
}

class MockMeter implements MeterLike {
  counters: { name: string; opts?: { description?: string } }[] = [];
  counterMap = new Map<string, MockCounter>();

  createCounter(name: string, opts?: { description?: string }): MockCounter {
    this.counters.push({ name, opts });

    const counter = new MockCounter();

    this.counterMap.set(name, counter);

    return counter;
  }
}

class MockMeterProvider implements MeterProviderLike {
  meter: MockMeter;
  forceFlushCalls = 0;
  shutdownCalls = 0;

  constructor() {
    this.meter = new MockMeter();
  }

  getMeter(): MockMeter {
    return this.meter;
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

class MinimalMeterProvider implements MeterProviderLike {
  meter: MockMeter;

  constructor() {
    this.meter = new MockMeter();
  }

  getMeter(): MockMeter {
    return this.meter;
  }
}

describe("OtelMetricsSink", () => {
  describe("constructor", () => {
    it("creates a counter named sensored.detections with description", () => {
      const provider = new MockMeterProvider();
      const sink = new OtelMetricsSink({ provider });

      expect(provider.meter.counters).toHaveLength(1);
      expect(provider.meter.counters[0].name).toBe("sensored.detections");
      expect(provider.meter.counters[0].opts?.description).toBe(
        "Count of PII detections by entity type and action",
      );

      expect(sink).toBeDefined();
    });

    it("uses custom meter name and version when provided", () => {
      const getMeter = mock(() => new MockMeter());
      const provider: MeterProviderLike = { getMeter };
      const sink = new OtelMetricsSink({
        provider,
        meterName: "custom.metrics",
        meterVersion: "3.0.0",
      });

      expect(getMeter).toHaveBeenCalledWith("custom.metrics", "3.0.0");

      expect(sink).toBeDefined();
    });

    it("uses default meter name and version when not provided", () => {
      const getMeter = mock(() => new MockMeter());
      const provider: MeterProviderLike = { getMeter };
      const sink = new OtelMetricsSink({ provider });

      expect(getMeter).toHaveBeenCalledWith("sensored.audit", "1.0.0");

      expect(sink).toBeDefined();
    });
  });

  describe("write", () => {
    it("increments counter by 1 with correct attributes", () => {
      const provider = new MockMeterProvider();
      const sink = new OtelMetricsSink({ provider });

      sink.write(
        makeEvent({
          ruleId: "ssn",
          entityType: "ssn",
          action: "mask",
        }),
      );

      const counter = provider.meter.counterMap.get("sensored.detections");

      if (!counter) {
        expect.fail("counter not found");
        return;
      }

      expect(counter.calls).toHaveLength(1);
      expect(counter.calls[0].value).toBe(1);
      expect(counter.calls[0].attributes).toEqual({
        entityType: "ssn",
        action: "mask",
        ruleId: "ssn",
      });
    });

    it("increments counter for each write call", () => {
      const provider = new MockMeterProvider();
      const sink = new OtelMetricsSink({ provider });

      sink.write(makeEvent());
      sink.write(makeEvent());
      sink.write(makeEvent());

      const counter = provider.meter.counterMap.get("sensored.detections");

      if (!counter) {
        expect.fail("counter not found");
        return;
      }

      expect(counter.calls).toHaveLength(3);

      for (const call of counter.calls) {
        expect(call.value).toBe(1);
      }
    });
  });

  describe("flush", () => {
    it("calls provider.forceFlush when it exists", async () => {
      const provider = new MockMeterProvider();
      const sink = new OtelMetricsSink({ provider });

      await sink.flush();

      expect(provider.forceFlushCalls).toBe(1);
    });

    it("does not throw when provider.forceFlush is missing", async () => {
      const provider = new MinimalMeterProvider();
      const sink = new OtelMetricsSink({ provider });

      await expect(sink.flush()).resolves.toBeUndefined();
    });
  });

  describe("close", () => {
    it("calls provider.shutdown when it exists", async () => {
      const provider = new MockMeterProvider();
      const sink = new OtelMetricsSink({ provider });

      await sink.close();

      expect(provider.shutdownCalls).toBe(1);
    });

    it("does not throw when provider.shutdown is missing", async () => {
      const provider = new MinimalMeterProvider();
      const sink = new OtelMetricsSink({ provider });

      await expect(sink.close()).resolves.toBeUndefined();
    });
  });
});
