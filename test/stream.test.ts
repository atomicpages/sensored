import { describe, expect, test } from "bun:test";
import {
  createRedactor,
  type DetectorDefinition,
  restore,
  SensoredError,
  type StreamEvent,
} from "../src";

async function* toChunks(text: string, size: number): AsyncIterable<string> {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
  }
}

async function collectText(
  events: AsyncIterable<StreamEvent>,
): Promise<string> {
  let text = "";
  for await (const event of events) {
    if (event.type === "text") {
      text += event.text;
    }
    if (event.type === "detection") {
      text += event.group.replacement;
    }
  }
  return text;
}

async function collectEvents(
  events: AsyncIterable<StreamEvent>,
): Promise<StreamEvent[]> {
  const result: StreamEvent[] = [];
  for await (const event of events) {
    result.push(event);
  }
  return result;
}

const ssnRedactor = createRedactor({
  rules: { us_ssn: { action: "redact" } },
});

const cardRedactor = createRedactor({
  rules: { payment_card: { action: "redact" } },
});

const emailRedactor = createRedactor({
  rules: { email: { action: "redact" } },
});

const mixedRedactor = createRedactor({
  rules: {
    payment_card: { action: "redact" },
    us_ssn: { action: "redact" },
  },
});

const allRedactor = createRedactor({
  rules: {
    email: { action: "redact" },
    payment_card: { action: "redact" },
    us_ssn: { action: "redact" },
  },
});

describe("streaming equivalence with complete-string", () => {
  test.each([
    ["SSN: 123-45-6789", ssnRedactor],
    ["Card: 4242 4242 4242 4242", cardRedactor],
    ["SSN: 123-45-6789 and Card: 4242 4242 4242 4242", mixedRedactor],
    ["123-45-6789 (SSN)", ssnRedactor],
    ["Card: 4242424242424242", cardRedactor],
    ["Email: alice+ops@example.com.", emailRedactor],
    ["a@b.co and z@host.example.au!", emailRedactor],
    ["<alice@example.com>", emailRedactor],
    [
      "alice@example.com and bob@example.com and carol@example.com",
      emailRedactor,
    ],
    [
      "SSN: 123-45-6789 Email: alice@example.com Card: 4242 4242 4242 4242",
      allRedactor,
    ],
  ])("chunked %s", async (input, redactor) => {
    const expected = redactor.redact(input);

    for (const size of [1, 4, 16, 256, 4096]) {
      const output = await collectText(redactor.stream(toChunks(input, size)));
      expect(output).toBe(expected);
    }
  });
});

describe("cross-fragment matches", () => {
  test("SSN split across two chunks", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "SSN: 123";
      yield "-45-6789";
    }

    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe("SSN: [US_SSN]");
  });

  test("payment card split across two chunks", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "Card: 4242 42";
      yield "42 4242 4242";
    }

    const output = await collectText(cardRedactor.stream(chunks()));
    expect(output).toBe("Card: [PAYMENT_CARD]");
  });

  test("SSN split across many tiny chunks", async () => {
    const input = "SSN: 123-45-6789";
    const expected = ssnRedactor.redact(input);

    const output = await collectText(ssnRedactor.stream(toChunks(input, 1)));
    expect(output).toBe(expected);
  });

  test("email split across two chunks at @", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "Email: alice";
      yield "@example.com";
    }

    const output = await collectText(emailRedactor.stream(chunks()));
    expect(output).toBe("Email: [EMAIL]");
  });

  test("email split across many tiny chunks", async () => {
    const input = "Email: alice+ops@example.com";
    const expected = emailRedactor.redact(input);

    const output = await collectText(emailRedactor.stream(toChunks(input, 1)));
    expect(output).toBe(expected);
  });

  test("email with padding to force mid-stream flush", async () => {
    const padding = "x".repeat(300);
    const input = `${padding}Email: alice@example.com`;
    const expected = emailRedactor.redact(input);

    for (const size of [1, 16, 256, 4096]) {
      const output = await collectText(
        emailRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });

  test("multiple emails with padding across flushes", async () => {
    const padding = "x".repeat(300);
    const input = `${padding}alice@example.com${padding}bob@example.com`;
    const expected = emailRedactor.redact(input);

    for (const size of [1, 16, 256, 4096]) {
      const output = await collectText(
        emailRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });
});

describe("context crossing boundaries", () => {
  test("SSN label in one chunk, number in next", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "SSN:";
      yield " 123-45-6789";
    }

    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe("SSN: [US_SSN]");
  });

  test("SSN following context in next chunk", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "123-45-6789";
      yield " (SSN)";
    }

    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe("[US_SSN] (SSN)");
  });

  test("SSN with padding to force mid-stream flush", async () => {
    const padding = "x".repeat(100);
    const input = `${padding}SSN: 123-45-6789`;
    const expected = ssnRedactor.redact(input);

    for (const size of [1, 16, 64, 256]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });
});

describe("surrogate and grapheme splits", () => {
  test("emoji before SSN split at surrogate boundary", async () => {
    const text = "\uD83D\uDE00 SSN: 123-45-6789";
    const expected = ssnRedactor.redact(text);

    async function* chunks(): AsyncIterable<string> {
      yield text.slice(0, 1);
      yield text.slice(1);
    }

    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe(expected);
  });

  test("emoji with padding split at surrogate boundary", async () => {
    const padding = "x".repeat(100);
    const text = `${padding}\uD83D\uDE00 SSN: 123-45-6789`;
    const expected = ssnRedactor.redact(text);

    async function* chunks(): AsyncIterable<string> {
      yield text.slice(0, 101);
      yield text.slice(101);
    }

    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe(expected);
  });

  test("combining marks split across chunks", async () => {
    const text = "e\u0301 SSN: 123-45-6789";
    const expected = ssnRedactor.redact(text);

    async function* chunks(): AsyncIterable<string> {
      yield text.slice(0, 1);
      yield text.slice(1);
    }

    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe(expected);
  });

  test("combining marks with padding split across chunks", async () => {
    const padding = "x".repeat(100);
    const text = `${padding}e\u0301 SSN: 123-45-6789`;
    const expected = ssnRedactor.redact(text);

    async function* chunks(): AsyncIterable<string> {
      yield text.slice(0, 101);
      yield text.slice(101);
    }

    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe(expected);
  });
});

describe("buffer overflow", () => {
  test("exceeding 65536 pending units throws BUFFER_LIMIT", async () => {
    const detector: DetectorDefinition = {
      id: "overflow",
      entityType: "overflow",
      replacement: "[OVERFLOW]",
      pattern: /never_matches_x/,
      stream: {
        maxMatchLength: 65536,
        leftContext: 0,
        rightContext: 0,
        boundaryLookaround: 0,
      },
    };

    const redactor = createRedactor({
      detectors: [detector],
      rules: { overflow: { action: "redact" } },
    });

    async function* chunks(): AsyncIterable<string> {
      for (let i = 0; i < 65537; i++) {
        yield "x";
      }
    }

    try {
      await collectText(redactor.stream(chunks()));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect((error as SensoredError).code).toBe("BUFFER_LIMIT");
    }
  });
});

describe("cancellation", () => {
  test("abort mid-stream throws CANCELLED", async () => {
    const controller = new AbortController();

    async function* chunks(): AsyncIterable<string> {
      yield "x".repeat(100);
      controller.abort();
      yield " SSN: 123-45-6789";
    }

    const events: StreamEvent[] = [];
    try {
      for await (const event of ssnRedactor.stream(chunks(), {
        signal: controller.signal,
      })) {
        events.push(event);
      }
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect((error as SensoredError).code).toBe("CANCELLED");
    }

    expect(events.length).toBeGreaterThan(0);
  });

  test("abort before any chunks throws CANCELLED", async () => {
    const controller = new AbortController();
    controller.abort();

    async function* chunks(): AsyncIterable<string> {
      yield "SSN: 123-45-6789";
    }

    try {
      await collectText(
        ssnRedactor.stream(chunks(), { signal: controller.signal }),
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect((error as SensoredError).code).toBe("CANCELLED");
    }
  });
});

describe("normal completion", () => {
  test("complete event emitted on success", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "SSN: 123-45-6789";
    }

    const events = await collectEvents(ssnRedactor.stream(chunks()));
    const last = events[events.length - 1];
    expect(last?.type).toBe("complete");
  });

  test("empty stream emits only complete", async () => {
    async function* chunks(): AsyncIterable<string> {}

    const events = await collectEvents(ssnRedactor.stream(chunks()));
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("complete");
  });

  test("end of stream flushes remaining buffer", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "SSN: 123-45-6789";
    }

    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe("SSN: [US_SSN]");
  });
});

describe("stream unsupported", () => {
  test("custom detector without stream metadata throws STREAM_UNSUPPORTED", () => {
    const detector: DetectorDefinition = {
      id: "nostream",
      entityType: "nostream",
      replacement: "[NOSTREAM]",
      pattern: /\d+/,
    };

    const redactor = createRedactor({
      detectors: [detector],
      rules: { nostream: { action: "redact" } },
    });

    async function* chunks(): AsyncIterable<string> {
      yield "test123";
    }

    expect(() => redactor.stream(chunks())).toThrow(SensoredError);
    try {
      redactor.stream(chunks());
    } catch (error) {
      expect((error as SensoredError).code).toBe("STREAM_UNSUPPORTED");
    }
  });

  test("payment_card only works", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "4242 4242 4242 4242";
    }

    const output = await collectText(cardRedactor.stream(chunks()));
    expect(output).toBe("[PAYMENT_CARD]");
  });

  test("us_ssn only works", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "SSN: 123-45-6789";
    }

    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe("SSN: [US_SSN]");
  });

  test("email only works", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "alice@example.com";
    }

    const output = await collectText(emailRedactor.stream(chunks()));
    expect(output).toBe("[EMAIL]");
  });

  test("all three built-in detectors work together", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "alice@example.com SSN: 123-45-6789 Card: 4242 4242 4242 4242";
    }

    const output = await collectText(allRedactor.stream(chunks()));
    expect(output).toBe("[EMAIL] SSN: [US_SSN] Card: [PAYMENT_CARD]");
  });
});

describe("reporting", () => {
  test("detection events with report true have correct absolute offsets", async () => {
    const padding = ".".repeat(100);
    const input = `${padding}SSN: 123-45-6789`;

    async function* chunks(): AsyncIterable<string> {
      yield input;
    }

    const events = await collectEvents(
      ssnRedactor.stream(chunks(), { report: true }),
    );

    const detectionEvents = events.filter((e) => e.type === "detection");

    expect(detectionEvents).toHaveLength(1);

    const group = detectionEvents[0];

    if (group?.type === "detection") {
      expect(group.group.start).toBe(105);
      expect(group.group.end).toBe(116);
      expect(group.group.replacement).toBe("[US_SSN]");
      expect(group.group.matches).toHaveLength(1);
      expect(group.group.matches[0]?.value).toBe("123-45-6789");
      expect(group.group.matches[0]?.ruleId).toBe("us_ssn");
    }
  });

  test("report false emits only text events", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "SSN: 123-45-6789";
    }

    const events = await collectEvents(
      ssnRedactor.stream(chunks(), { report: false }),
    );

    const nonComplete = events.filter((e) => e.type !== "complete");

    for (const event of nonComplete) {
      expect(event.type).toBe("text");
    }
  });

  test("complete event always emitted on success with report", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "SSN: 123-45-6789";
    }

    const events = await collectEvents(
      ssnRedactor.stream(chunks(), { report: true }),
    );

    expect(events[events.length - 1]?.type).toBe("complete");
  });

  test("multiple detections with correct offsets across flushes", async () => {
    const padding = ".".repeat(100);
    const input = `${padding}SSN: 123-45-6789${padding}SSN: 234-56-7890`;

    async function* chunks(): AsyncIterable<string> {
      yield input;
    }

    const events = await collectEvents(
      ssnRedactor.stream(chunks(), { report: true }),
    );

    const detectionEvents = events.filter((e) => e.type === "detection");

    expect(detectionEvents).toHaveLength(2);

    if (detectionEvents[0]?.type === "detection") {
      expect(detectionEvents[0].group.start).toBe(105);
      expect(detectionEvents[0].group.end).toBe(116);
    }

    if (detectionEvents[1]?.type === "detection") {
      expect(detectionEvents[1].group.start).toBe(221);
      expect(detectionEvents[1].group.end).toBe(232);
    }
  });
});

describe("adversarial", () => {
  test("many SSNs close together", async () => {
    const ssn = "SSN: 123-45-6789 ";
    const input = ssn.repeat(50);
    const expected = ssnRedactor.redact(input);

    for (const size of [1, 16, 64, 256]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });

  test("very small chunks (1 UTF-16 unit at a time)", async () => {
    const input = "SSN: 123-45-6789 and Card: 4242 4242 4242 4242";
    const expected = mixedRedactor.redact(input);

    const output = await collectText(mixedRedactor.stream(toChunks(input, 1)));
    expect(output).toBe(expected);
  });

  test("single character chunks with padding", async () => {
    const padding = "x".repeat(200);
    const input = `${padding}SSN: 123-45-6789${padding}Card: 4242 4242 4242 4242${padding}`;
    const expected = mixedRedactor.redact(input);

    const output = await collectText(mixedRedactor.stream(toChunks(input, 1)));
    expect(output).toBe(expected);
  });

  test("source error throws SOURCE_FAILURE", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "SSN: 123";
      throw new Error("source error");
    }

    try {
      await collectText(ssnRedactor.stream(chunks()));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect((error as SensoredError).code).toBe("SOURCE_FAILURE");
    }
  });

  test("mid-stream failure after output emitted marks result incomplete", async () => {
    const padding = "x".repeat(200);

    async function* chunks(): AsyncIterable<string> {
      yield `${padding} SSN: 123-45-6789 ${"x".repeat(60)}`;
      throw new Error("source error");
    }

    const events: StreamEvent[] = [];
    try {
      for await (const event of ssnRedactor.stream(chunks(), {
        report: true,
      })) {
        events.push(event);
      }
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect((error as SensoredError).code).toBe("SOURCE_FAILURE");
    }

    const textEvents = events.filter((e) => e.type === "text");
    const detectionEvents = events.filter((e) => e.type === "detection");
    expect(textEvents.length).toBeGreaterThan(0);
    expect(detectionEvents).toHaveLength(1);

    const completeEvents = events.filter((e) => e.type === "complete");
    expect(completeEvents).toHaveLength(0);
  });

  test("overflow after output emitted throws BUFFER_LIMIT", async () => {
    const padding = "x".repeat(200);

    async function* chunks(): AsyncIterable<string> {
      yield `${padding} SSN: 123-45-6789 ${"x".repeat(60)}`;
      yield "y".repeat(70000);
    }

    const events: StreamEvent[] = [];
    try {
      for await (const event of ssnRedactor.stream(chunks(), {
        report: true,
      })) {
        events.push(event);
      }
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect((error as SensoredError).code).toBe("BUFFER_LIMIT");
    }

    const textEvents = events.filter((e) => e.type === "text");
    const detectionEvents = events.filter((e) => e.type === "detection");
    expect(textEvents.length).toBeGreaterThan(0);
    expect(detectionEvents).toHaveLength(1);

    const completeEvents = events.filter((e) => e.type === "complete");
    expect(completeEvents).toHaveLength(0);
  });

  test("cancellation after output emitted throws CANCELLED", async () => {
    const controller = new AbortController();
    const padding = "x".repeat(200);

    async function* chunks(): AsyncIterable<string> {
      yield `${padding} SSN: 123-45-6789 ${"x".repeat(60)}`;
      controller.abort();
      yield " more text";
    }

    const events: StreamEvent[] = [];
    try {
      for await (const event of ssnRedactor.stream(chunks(), {
        signal: controller.signal,
        report: true,
      })) {
        events.push(event);
      }
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect((error as SensoredError).code).toBe("CANCELLED");
    }

    const textEvents = events.filter((e) => e.type === "text");
    const detectionEvents = events.filter((e) => e.type === "detection");
    expect(textEvents.length).toBeGreaterThan(0);
    expect(detectionEvents).toHaveLength(1);

    const completeEvents = events.filter((e) => e.type === "complete");
    expect(completeEvents).toHaveLength(0);
  });

  test("mask action in streaming", async () => {
    const maskRedactor = createRedactor({
      rules: {
        us_ssn: { action: "mask", preserve: { last: 4 } },
      },
    });

    const input = "SSN: 123-45-6789";
    const expected = maskRedactor.redact(input);

    for (const size of [1, 16, 256]) {
      const output = await collectText(
        maskRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });

  test("remove action in streaming", async () => {
    const removeRedactor = createRedactor({
      rules: { us_ssn: { action: "remove" } },
    });

    const input = "SSN: 123-45-6789";
    const expected = removeRedactor.redact(input);

    for (const size of [1, 16, 256]) {
      const output = await collectText(
        removeRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });
});

describe("streaming restore", () => {
  const restoreRedactor = createRedactor({
    rules: {
      email: { action: "redact" },
      phone: { action: "redact" },
    },
    restore: true,
  });

  test("emits restoration map on complete event", async () => {
    const events = await collectEvents(
      restoreRedactor.stream(
        toChunks("contact john@example.com or call 555-123-4567", 10),
      ),
    );
    const completeEvent = events.find((e) => e.type === "complete");
    expect(completeEvent).toBeDefined();
    expect((completeEvent as { map?: unknown }).map).toBeDefined();
    const map = (completeEvent as { map: Record<string, string> }).map;
    expect(Object.keys(map).length).toBeGreaterThan(0);
  });

  test("round-trips through restore()", async () => {
    const original = "contact john@example.com or call 555-123-4567";
    const events = await collectEvents(
      restoreRedactor.stream(toChunks(original, 10)),
    );
    const completeEvent = events.find((e) => e.type === "complete");
    const map = (completeEvent as { map: Record<string, string> }).map;
    const redactedText = await collectText(
      restoreRedactor.stream(toChunks(original, 10)),
    );
    const restored = restore(redactedText, map);
    expect(restored).toBe(original);
  });

  test("complete event has no map when restore is false", async () => {
    const noRestoreRedactor = createRedactor({
      rules: { email: { action: "redact" } },
    });

    const events = await collectEvents(
      noRestoreRedactor.stream(toChunks("email john@example.com", 10)),
    );
    const completeEvent = events.find((e) => e.type === "complete");
    expect(completeEvent).toBeDefined();
    expect((completeEvent as { map?: unknown }).map).toBeUndefined();
  });

  test("works across multiple chunk sizes", async () => {
    const original = "email john@example.com and jane@test.org";
    const events = await collectEvents(
      restoreRedactor.stream(toChunks(original, 1)),
    );
    const completeEvent = events.find((e) => e.type === "complete");
    const map = (completeEvent as { map: Record<string, string> }).map;
    const redactedText = await collectText(
      restoreRedactor.stream(toChunks(original, 1)),
    );
    expect(restore(redactedText, map)).toBe(original);
  });
});
