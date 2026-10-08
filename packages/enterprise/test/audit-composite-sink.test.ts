import { describe, expect, it } from "bun:test";
import type { AuditEvent, AuditSink } from "sensored";
import { CompositeAuditSink } from "../src/audit/composite-sink";

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

class TrackingSink implements AuditSink {
  writeCalls: AuditEvent[] = [];
  flushCalls = 0;
  closeCalls = 0;

  write(event: AuditEvent): void {
    this.writeCalls.push(event);
  }

  flush(): Promise<void> {
    this.flushCalls++;

    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closeCalls++;

    return Promise.resolve();
  }
}

class FlushOnlySink implements AuditSink {
  writeCalls = 0;
  flushCalls = 0;

  write(): void {
    this.writeCalls++;
  }

  flush(): Promise<void> {
    this.flushCalls++;

    return Promise.resolve();
  }
}

class CloseOnlySink implements AuditSink {
  writeCalls = 0;
  closeCalls = 0;

  write(): void {
    this.writeCalls++;
  }

  close(): Promise<void> {
    this.closeCalls++;

    return Promise.resolve();
  }
}

class WriteOnlySink implements AuditSink {
  writeCalls = 0;

  write(): void {
    this.writeCalls++;
  }
}

class FailingSink implements AuditSink {
  writeCalls = 0;
  flushCalls = 0;
  closeCalls = 0;

  write(): void {
    this.writeCalls++;
    throw new Error("write failed");
  }

  flush(): Promise<void> {
    this.flushCalls++;
    return Promise.reject(new Error("flush failed"));
  }

  close(): Promise<void> {
    this.closeCalls++;
    return Promise.reject(new Error("close failed"));
  }
}

describe("CompositeAuditSink", () => {
  describe("write", () => {
    it("fans out to all sinks", () => {
      const sinkA = new TrackingSink();
      const sinkB = new TrackingSink();
      const composite = new CompositeAuditSink({ sinks: [sinkA, sinkB] });
      const event = makeEvent();

      composite.write(event);

      expect(sinkA.writeCalls).toHaveLength(1);
      expect(sinkA.writeCalls[0]).toBe(event);
      expect(sinkB.writeCalls).toHaveLength(1);
      expect(sinkB.writeCalls[0]).toBe(event);
    });

    it("continues when one sink throws", () => {
      const failing = new FailingSink();
      const ok = new TrackingSink();
      const composite = new CompositeAuditSink({ sinks: [failing, ok] });

      composite.write(makeEvent());

      expect(failing.writeCalls).toBe(1);
      expect(ok.writeCalls).toHaveLength(1);
    });

    it("handles empty sinks array", () => {
      const composite = new CompositeAuditSink({ sinks: [] });

      expect(() => composite.write(makeEvent())).not.toThrow();
    });
  });

  describe("flush", () => {
    it("calls flush on all sinks that have it", async () => {
      const tracking = new TrackingSink();
      const flushOnly = new FlushOnlySink();
      const writeOnly = new WriteOnlySink();
      const composite = new CompositeAuditSink({
        sinks: [tracking, flushOnly, writeOnly],
      });

      await composite.flush();

      expect(tracking.flushCalls).toBe(1);
      expect(flushOnly.flushCalls).toBe(1);
    });

    it("continues when one sink flush throws", async () => {
      const failing = new FailingSink();
      const ok = new TrackingSink();
      const composite = new CompositeAuditSink({ sinks: [failing, ok] });

      await composite.flush();

      expect(failing.flushCalls).toBe(1);
      expect(ok.flushCalls).toBe(1);
    });
  });

  describe("close", () => {
    it("calls close on all sinks that have it", async () => {
      const tracking = new TrackingSink();
      const closeOnly = new CloseOnlySink();
      const writeOnly = new WriteOnlySink();
      const composite = new CompositeAuditSink({
        sinks: [tracking, closeOnly, writeOnly],
      });

      await composite.close();

      expect(tracking.closeCalls).toBe(1);
      expect(closeOnly.closeCalls).toBe(1);
    });

    it("continues when one sink close throws", async () => {
      const failing = new FailingSink();
      const ok = new TrackingSink();
      const composite = new CompositeAuditSink({ sinks: [failing, ok] });

      await composite.close();

      expect(failing.closeCalls).toBe(1);
      expect(ok.closeCalls).toBe(1);
    });
  });

  describe("full lifecycle", () => {
    it("write, flush, and close all work together", async () => {
      const sinkA = new TrackingSink();
      const sinkB = new TrackingSink();
      const composite = new CompositeAuditSink({ sinks: [sinkA, sinkB] });

      composite.write(makeEvent());
      composite.write(makeEvent());
      await composite.flush();
      await composite.close();

      expect(sinkA.writeCalls).toHaveLength(2);
      expect(sinkB.writeCalls).toHaveLength(2);
      expect(sinkA.flushCalls).toBe(1);
      expect(sinkB.flushCalls).toBe(1);
      expect(sinkA.closeCalls).toBe(1);
      expect(sinkB.closeCalls).toBe(1);
    });
  });
});
