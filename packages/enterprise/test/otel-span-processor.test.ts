import { describe, expect, it } from "bun:test";
import type { RedactorConfig } from "sensored";
import {
  type RedactionConfig,
  SensoredSpanProcessor,
} from "../src/otel/span-processor";

const testRedactorConfig: RedactorConfig = {
  rules: {
    email: { action: "redact" },
    phone: { action: "redact" },
  },
};

interface MockSpan {
  name: string;
  attributes: Record<string, unknown>;
  [key: string]: unknown;
}

class MockSpanProcessor {
  onStartCalls: { span: unknown; parentContext: unknown }[] = [];
  onEndCalls: { span: unknown }[] = [];
  forceFlushCalls = 0;
  shutdownCalls = 0;

  onStart(span: unknown, parentContext: unknown): void {
    this.onStartCalls.push({ span, parentContext });
  }

  onEnd(span: unknown): void {
    this.onEndCalls.push({ span });
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

describe("SensoredSpanProcessor", () => {
  it("delegates onStart unchanged", () => {
    const mock = new MockSpanProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredSpanProcessor(
      mock as unknown as MockSpanProcessor,
      config,
    );

    const span = { name: "test", attributes: {} };

    processor.onStart(span, undefined);

    expect(mock.onStartCalls.length).toBe(1);
    expect(mock.onStartCalls[0].span).toBe(span);
  });

  it("redacts span name and attributes on onEnd", () => {
    const mock = new MockSpanProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredSpanProcessor(
      mock as unknown as MockSpanProcessor,
      config,
    );

    const span: MockSpan = {
      name: "operation admin@example.com",
      attributes: {
        email: "user@example.com",
        count: 42,
        active: true,
      },
    };

    processor.onEnd(span as unknown as MockSpan);

    expect(mock.onEndCalls.length).toBe(1);

    const redactedSpan = mock.onEndCalls[0].span as MockSpan;

    expect(redactedSpan.name).not.toContain("admin@example.com");
    expect(redactedSpan.attributes.email).not.toContain("user@example.com");
    expect(redactedSpan.attributes.count).toBe(42);
    expect(redactedSpan.attributes.active).toBe(true);
  });

  it("does not mutate the original span on onEnd", () => {
    const mock = new MockSpanProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredSpanProcessor(
      mock as unknown as MockSpanProcessor,
      config,
    );

    const span: MockSpan = {
      name: "operation admin@example.com",
      attributes: { email: "user@example.com" },
    };

    processor.onEnd(span as unknown as MockSpan);

    expect(span.name).toBe("operation admin@example.com");
    expect(span.attributes.email).toBe("user@example.com");
  });

  it("respects includeAttributes on span attributes", () => {
    const mock = new MockSpanProcessor();
    const config: RedactionConfig = {
      redactorConfig: testRedactorConfig,
      includeAttributes: ["email"],
    };

    const processor = new SensoredSpanProcessor(
      mock as unknown as MockSpanProcessor,
      config,
    );

    const span: MockSpan = {
      name: "test admin@example.com",
      attributes: {
        email: "user@example.com",
        phone: "+1-555-123-4567",
      },
    };

    processor.onEnd(span as unknown as MockSpan);

    const redactedSpan = mock.onEndCalls[0].span as MockSpan;

    expect(redactedSpan.attributes.email).not.toContain("user@example.com");
    expect(redactedSpan.attributes.phone).toBe("+1-555-123-4567");
  });

  it("respects excludeAttributes on span attributes", () => {
    const mock = new MockSpanProcessor();
    const config: RedactionConfig = {
      redactorConfig: testRedactorConfig,
      excludeAttributes: ["phone"],
    };

    const processor = new SensoredSpanProcessor(
      mock as unknown as MockSpanProcessor,
      config,
    );

    const span: MockSpan = {
      name: "test",
      attributes: {
        email: "user@example.com",
        phone: "+1-555-123-4567",
      },
    };

    processor.onEnd(span as unknown as MockSpan);

    const redactedSpan = mock.onEndCalls[0].span as MockSpan;

    expect(redactedSpan.attributes.email).not.toContain("user@example.com");
    expect(redactedSpan.attributes.phone).toBe("+1-555-123-4567");
  });

  it("delegates forceFlush", async () => {
    const mock = new MockSpanProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredSpanProcessor(
      mock as unknown as MockSpanProcessor,
      config,
    );

    await processor.forceFlush();

    expect(mock.forceFlushCalls).toBe(1);
  });

  it("delegates shutdown", async () => {
    const mock = new MockSpanProcessor();
    const config: RedactionConfig = { redactorConfig: testRedactorConfig };

    const processor = new SensoredSpanProcessor(
      mock as unknown as MockSpanProcessor,
      config,
    );

    await processor.shutdown();

    expect(mock.shutdownCalls).toBe(1);
  });
});
