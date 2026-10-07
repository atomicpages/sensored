import { describe, expect, test } from "bun:test";
import { type AuditEvent, type AuditSink, createRedactor } from "../src";

function createMemorySink(): {
  sink: AuditSink;
  events: AuditEvent[];
  flushCalls: number;
  closeCalls: number;
} {
  const events: AuditEvent[] = [];
  let flushCalls = 0;
  let closeCalls = 0;

  return {
    sink: {
      write(event: AuditEvent) {
        events.push(event);
      },
      flush() {
        flushCalls++;
        return Promise.resolve();
      },
      close() {
        closeCalls++;
        return Promise.resolve();
      },
    },
    events,
    flushCalls,
    closeCalls,
  };
}

function createThrowingSink(): AuditSink {
  return {
    write() {
      throw new Error("sink exploded");
    },
  };
}

describe("audit event emission", () => {
  describe("redact()", () => {
    test("emits audit events for each detection", () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
        auditSink: sink,
      });

      const text = "Contact alice@example.com or bob@test.org";
      const result = redactor.redact(text);

      expect(result).toBe("Contact [EMAIL] or [EMAIL]");
      expect(events).toHaveLength(2);

      expect(events[0]?.ruleId).toBe("email");
      expect(events[0]?.entityType).toBe("email");
      expect(events[0]?.action).toBe("redact");
      expect(events[0]?.replacement).toBe("[EMAIL]");
      expect(events[0]?.start).toBe(8);
      expect(events[0]?.end).toBe(25);
      expect(typeof events[0]?.timestamp).toBe("number");

      expect(events[1]?.ruleId).toBe("email");
      expect(events[1]?.entityType).toBe("email");
      expect(events[1]?.action).toBe("redact");
      expect(events[1]?.replacement).toBe("[EMAIL]");
    });

    test("does not emit events when no auditSink configured", () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
      });

      redactor.redact("Contact alice@example.com");
      expect(events).toHaveLength(0);
    });

    test("swallows sink errors without breaking redaction", () => {
      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
        auditSink: createThrowingSink(),
      });

      expect(() => redactor.redact("Contact alice@example.com")).not.toThrow();
    });

    test("carries correct action type for mask", () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: { email: { action: "mask" } },
        auditSink: sink,
      });

      redactor.redact("Contact alice@example.com");
      expect(events[0]?.action).toBe("mask");
    });

    test("carries correct action type for remove", () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: { email: { action: "remove" } },
        auditSink: sink,
      });

      redactor.redact("Contact alice@example.com now");
      expect(events[0]?.action).toBe("remove");
    });

    test("carries correct action type for format-preserve", () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: { email: { action: "format-preserve" } },
        auditSink: sink,
      });

      redactor.redact("Contact alice@example.com");
      expect(events[0]?.action).toBe("format-preserve");
    });

    test("carries correct action type for token-replace", () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: { email: { action: "token-replace" } },
        auditSink: sink,
      });

      redactor.redact("Contact alice@example.com");
      expect(events[0]?.action).toBe("token-replace");
    });

    test("AuditEvent never contains original PII value", () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
        auditSink: sink,
      });

      redactor.redact("Contact alice@example.com");

      const event = events[0];
      expect(event).toBeDefined();

      const serialized = JSON.stringify(event);
      expect(serialized).not.toContain("alice");
      expect(serialized).not.toContain("alice@example.com");
    });

    test("carries reasons from detection", () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
        auditSink: sink,
      });

      redactor.redact("Contact alice@example.com");

      expect(events[0]?.reasons).toContain("email.ascii_dot_atom");
    });
  });

  describe("inspect()", () => {
    test("emits audit events from inspect", () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
        auditSink: sink,
      });

      const result = redactor.inspect("Contact alice@example.com");

      expect(events).toHaveLength(1);
      expect(events[0]?.ruleId).toBe("email");
      expect(result.groups).toHaveLength(1);
    });

    test("inspect works without auditSink", () => {
      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
      });

      const result = redactor.inspect("Contact alice@example.com");
      expect(result.groups).toHaveLength(1);
    });
  });

  describe("redactAsync()", () => {
    test("emits audit events from redactAsync", async () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
        auditSink: sink,
      });

      await redactor.redactAsync("Contact alice@example.com");

      expect(events).toHaveLength(1);
      expect(events[0]?.ruleId).toBe("email");
    });

    test("redactAsync works without auditSink", async () => {
      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
      });

      const result = await redactor.redactAsync("Contact alice@example.com");
      expect(result.detections).toHaveLength(1);
    });

    test("swallows sink errors in redactAsync", async () => {
      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
        auditSink: createThrowingSink(),
      });

      const result = await redactor.redactAsync("Contact alice@example.com");
      expect(result.detections).toHaveLength(1);
    });
  });

  describe("stream()", () => {
    test("emits audit events from stream", async () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
        auditSink: sink,
      });

      const chunks = (async function* () {
        yield "Contact alice@";
        yield "example.com for details";
      })();

      const events_collected: { type: string }[] = [];
      for await (const event of redactor.stream(chunks)) {
        events_collected.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.ruleId).toBe("email");
      expect(events[0]?.entityType).toBe("email");
      expect(events[0]?.action).toBe("redact");
    });

    test("stream works without auditSink", async () => {
      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
      });

      const chunks = (async function* () {
        yield "Contact alice@";
        yield "example.com for details";
      })();

      const events: { type: string }[] = [];
      for await (const event of redactor.stream(chunks)) {
        events.push(event);
      }

      expect(events.some((e) => e.type === "complete")).toBe(true);
    });

    test("stream swallows sink errors", async () => {
      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
        auditSink: createThrowingSink(),
      });

      const chunks = (async function* () {
        yield "Contact alice@";
        yield "example.com for details";
      })();

      const events: { type: string }[] = [];
      expect(async () => {
        for await (const event of redactor.stream(chunks)) {
          events.push(event);
        }
      }).not.toThrow();
    });

    test("stream audit events have absolute offsets", async () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
        auditSink: sink,
      });

      const chunks = (async function* () {
        yield "Contact alice@";
        yield "example.com for details";
      })();

      for await (const _ of redactor.stream(chunks)) {
        // consume
      }

      expect(events[0]?.start).toBe(8);
      expect(events[0]?.end).toBe(25);
    });
  });

  describe("detectOnly mode with audit", () => {
    test("emits audit events with correct action in detect-only mode", () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
        detectOnly: true,
        auditSink: sink,
      });

      const text = "Contact alice@example.com";
      const result = redactor.redact(text);

      expect(result).toBe(text);
      expect(events).toHaveLength(1);
      expect(events[0]?.action).toBe("redact");
    });
  });

  describe("InspectionGroup.action", () => {
    test("action is set on inspection groups", () => {
      const redactor = createRedactor({
        rules: { email: { action: "mask" } },
      });

      const result = redactor.inspect("Contact alice@example.com");
      expect(result.groups[0]?.action).toBe("mask");
    });

    test("action is set on stream detection events", async () => {
      const redactor = createRedactor({
        rules: { email: { action: "remove" } },
      });

      const chunks = (async function* () {
        yield "Contact alice@example.com now";
      })();

      const detectionEvents: { type: string; group?: { action?: string } }[] =
        [];
      for await (const event of redactor.stream(chunks, { report: true })) {
        detectionEvents.push(event);
      }

      const detection = detectionEvents.find((e) => e.type === "detection");
      expect(detection?.group?.action).toBe("remove");
    });
  });

  describe("multiple detections", () => {
    test("emits events for overlapping detections from different rules", () => {
      const { sink, events } = createMemorySink();

      const redactor = createRedactor({
        rules: {
          email: { action: "redact" },
          phone: { action: "mask" },
        },
        auditSink: sink,
      });

      redactor.redact("Contact alice@example.com or +1-555-123-4567");

      expect(events.length).toBeGreaterThanOrEqual(2);

      const emailEvent = events.find((e) => e.entityType === "email");
      const phoneEvent = events.find((e) => e.entityType === "phone");

      expect(emailEvent?.action).toBe("redact");
      expect(phoneEvent?.action).toBe("mask");
    });
  });

  describe("flush and close", () => {
    test("sink flush and close are optional", () => {
      const events: AuditEvent[] = [];
      const sink: AuditSink = {
        write(event) {
          events.push(event);
        },
      };

      const redactor = createRedactor({
        rules: { email: { action: "redact" } },
        auditSink: sink,
      });

      expect(() => redactor.redact("alice@example.com")).not.toThrow();
      expect(events).toHaveLength(1);
    });
  });
});
