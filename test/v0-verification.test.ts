import { describe, expect, test } from "bun:test";
import {
  createRedactor,
  MAX_INPUT_LENGTH,
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

const mixedRedactor = createRedactor({
  rules: {
    payment_card: { action: "redact" },
    us_ssn: { action: "redact" },
  },
});

describe("v0: chained overlaps in streaming", () => {
  test("adjacent SSN and card across chunk boundaries", async () => {
    const input = "SSN: 123-45-6789 Card: 4242 4242 4242 4242";
    const expected = mixedRedactor.redact(input);

    for (const size of [1, 4, 16, 256, 4096]) {
      const output = await collectText(
        mixedRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });

  test("multiple SSNs and cards interleaved across chunks", async () => {
    const input =
      "SSN: 123-45-6789 Card: 4242 4242 4242 4242 SSN: 234-56-7890 Card: 5555 5555 5555 4444";
    const expected = mixedRedactor.redact(input);

    for (const size of [1, 8, 32, 256, 4096]) {
      const output = await collectText(
        mixedRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });

  test("SSN immediately followed by card with no space", async () => {
    const input = "SSN: 123-45-6789Card: 4242 4242 4242 4242";
    const expected = mixedRedactor.redact(input);

    for (const size of [1, 11, 16, 256]) {
      const output = await collectText(
        mixedRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });

  test("card immediately followed by SSN with no space", async () => {
    const input = "Card: 4242 4242 4242 4242SSN: 123-45-6789";
    const expected = mixedRedactor.redact(input);

    for (const size of [1, 19, 32, 256]) {
      const output = await collectText(
        mixedRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });
});

describe("v0: input limit", () => {
  test("exactly MAX_INPUT_LENGTH passes", () => {
    const text = "x".repeat(MAX_INPUT_LENGTH);
    expect(() => ssnRedactor.redact(text)).not.toThrow();
  });

  test("MAX_INPUT_LENGTH + 1 throws INPUT_LIMIT", () => {
    const text = "x".repeat(MAX_INPUT_LENGTH + 1);
    try {
      ssnRedactor.redact(text);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect((error as SensoredError).code).toBe("INPUT_LIMIT");
    }
  });

  test("custom maxInputLength respected", () => {
    const redactor = createRedactor({
      rules: { us_ssn: { action: "redact" } },
      limits: { maxInputLength: 100 },
    });

    expect(() => redactor.redact("x".repeat(100))).not.toThrow();

    try {
      redactor.redact("x".repeat(101));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect((error as SensoredError).code).toBe("INPUT_LIMIT");
    }
  });
});

describe("v0: long combining sequences", () => {
  test("multiple combining marks split across chunks", async () => {
    const text = "e\u0301\u0302\u0303 SSN: 123-45-6789";
    const expected = ssnRedactor.redact(text);

    for (const splitPoint of [1, 2, 3, 4]) {
      async function* chunks(): AsyncIterable<string> {
        yield text.slice(0, splitPoint);
        yield text.slice(splitPoint);
      }

      const output = await collectText(ssnRedactor.stream(chunks()));
      expect(output).toBe(expected);
    }
  });

  test("long combining sequence with padding split across chunks", async () => {
    const padding = "x".repeat(100);
    const text = `${padding}e\u0301\u0302\u0303\u0304 SSN: 123-45-6789`;
    const expected = ssnRedactor.redact(text);

    for (const splitPoint of [100, 101, 102, 103, 104, 105]) {
      async function* chunks(): AsyncIterable<string> {
        yield text.slice(0, splitPoint);
        yield text.slice(splitPoint);
      }

      const output = await collectText(ssnRedactor.stream(chunks()));
      expect(output).toBe(expected);
    }
  });

  test("combining sequence at various chunk sizes", async () => {
    const text = "a\u0301\u0302b\u0303\u0304c\u0305\u0306 SSN: 123-45-6789";
    const expected = ssnRedactor.redact(text);

    for (const size of [1, 2, 3, 4, 8, 16, 256]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(text, size)),
      );
      expect(output).toBe(expected);
    }
  });
});

describe("v0: ZWJ sequences", () => {
  const familyEmoji =
    "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66";

  test("family emoji before SSN split at surrogate boundary", async () => {
    const text = `${familyEmoji} SSN: 123-45-6789`;
    const expected = ssnRedactor.redact(text);

    for (const splitPoint of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      async function* chunks(): AsyncIterable<string> {
        yield text.slice(0, splitPoint);
        yield text.slice(splitPoint);
      }

      const output = await collectText(ssnRedactor.stream(chunks()));
      expect(output).toBe(expected);
    }
  });

  test("family emoji with padding split at ZWJ boundary", async () => {
    const padding = "x".repeat(100);
    const text = `${padding}${familyEmoji} SSN: 123-45-6789`;
    const expected = ssnRedactor.redact(text);

    const zwjOffsets = [
      100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111,
    ];

    for (const splitPoint of zwjOffsets) {
      async function* chunks(): AsyncIterable<string> {
        yield text.slice(0, splitPoint);
        yield text.slice(splitPoint);
      }

      const output = await collectText(ssnRedactor.stream(chunks()));
      expect(output).toBe(expected);
    }
  });

  test("family emoji between two SSNs split at various points", async () => {
    const text = `SSN: 123-45-6789 ${familyEmoji} SSN: 234-56-7890`;
    const expected = ssnRedactor.redact(text);

    for (const size of [1, 4, 16, 256]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(text, size)),
      );
      expect(output).toBe(expected);
    }
  });
});

describe("v0: match density extremes", () => {
  test("almost entirely matches", async () => {
    const unit = "SSN: 123-45-6789 ";
    const input = unit.repeat(50);
    const expected = ssnRedactor.redact(input);

    for (const size of [1, 16, 256, 4096]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });

  test("almost entirely text with single match", async () => {
    const padding = "x".repeat(10000);
    const input = `${padding}SSN: 123-45-6789${padding}`;
    const expected = ssnRedactor.redact(input);

    for (const size of [1, 16, 256, 4096]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });

  test("high density mixed SSN and card", async () => {
    const unit = "SSN: 123-45-6789 Card: 4242 4242 4242 4242 ";
    const input = unit.repeat(50);
    const expected = mixedRedactor.redact(input);

    for (const size of [1, 16, 256, 4096]) {
      const output = await collectText(
        mixedRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });
});

describe("v0: reporting on/off equivalence", () => {
  test("text output identical with report true vs false", async () => {
    const input = "SSN: 123-45-6789 and Card: 4242 4242 4242 4242";

    for (const size of [1, 16, 256, 4096]) {
      const withoutReport = await collectText(
        mixedRedactor.stream(toChunks(input, size)),
      );
      const withReport = await collectText(
        mixedRedactor.stream(toChunks(input, size), { report: true }),
      );
      expect(withReport).toBe(withoutReport);
    }
  });

  test("report equivalence with padding and multiple matches", async () => {
    const padding = "x".repeat(200);
    const input = `${padding}SSN: 123-45-6789${padding}Card: 4242 4242 4242 4242${padding}`;

    for (const size of [1, 64, 256, 4096]) {
      const withoutReport = await collectText(
        mixedRedactor.stream(toChunks(input, size)),
      );
      const withReport = await collectText(
        mixedRedactor.stream(toChunks(input, size), { report: true }),
      );
      expect(withReport).toBe(withoutReport);
    }
  });

  test("report equivalence matches complete-string", async () => {
    const input = "SSN: 123-45-6789 and Card: 4242 4242 4242 4242";
    const expected = mixedRedactor.redact(input);

    for (const size of [1, 16, 256, 4096]) {
      const withReport = await collectText(
        mixedRedactor.stream(toChunks(input, size), { report: true }),
      );
      expect(withReport).toBe(expected);
    }
  });
});

describe("v0: all three actions across fragment splits with mixed rules", () => {
  const maskCardRedactor = createRedactor({
    rules: {
      us_ssn: { action: "redact" },
      payment_card: { action: "mask", preserve: { last: 4 } },
    },
  });

  const maskSsnCardRedactor = createRedactor({
    rules: {
      us_ssn: { action: "mask", preserve: { last: 4 } },
      payment_card: { action: "redact" },
    },
  });

  const removeCardRedactor = createRedactor({
    rules: {
      us_ssn: { action: "redact" },
      payment_card: { action: "remove" },
    },
  });

  const removeSsnCardRedactor = createRedactor({
    rules: {
      us_ssn: { action: "remove" },
      payment_card: { action: "redact" },
    },
  });

  const maskCardRemoveSsnRedactor = createRedactor({
    rules: {
      us_ssn: { action: "remove" },
      payment_card: { action: "mask", preserve: { last: 4 } },
    },
  });

  const maskSsnRemoveCardRedactor = createRedactor({
    rules: {
      us_ssn: { action: "mask", preserve: { last: 4 } },
      payment_card: { action: "remove" },
    },
  });

  test.each([
    ["redact ssn + mask card", maskCardRedactor],
    ["mask ssn + redact card", maskSsnCardRedactor],
    ["redact ssn + remove card", removeCardRedactor],
    ["remove ssn + redact card", removeSsnCardRedactor],
    ["remove ssn + mask card", maskCardRemoveSsnRedactor],
    ["mask ssn + remove card", maskSsnRemoveCardRedactor],
  ])("%s", async (_label, redactor) => {
    const input = "SSN: 123-45-6789 Card: 4242 4242 4242 4242";
    const expected = redactor.redact(input);

    for (const size of [1, 16, 256, 4096]) {
      const output = await collectText(redactor.stream(toChunks(input, size)));
      expect(output).toBe(expected);
    }
  });
});

describe("v0: empty, single, and large chunk inputs", () => {
  test("empty string complete-string", () => {
    expect(ssnRedactor.redact("")).toBe("");
  });

  test("empty string streaming", async () => {
    async function* chunks(): AsyncIterable<string> {}
    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe("");
  });

  test("single character complete-string", () => {
    expect(ssnRedactor.redact("x")).toBe("x");
  });

  test("single character streaming", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "x";
    }
    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe("x");
  });

  test("large input (100 KiB) without matches across chunks", async () => {
    const input = "x".repeat(102400);
    const expected = ssnRedactor.redact(input);

    for (const size of [4096, 8192, 16384]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });

  test("large input (100 KiB) with match at end across chunks", async () => {
    const input = "x".repeat(102400) + "SSN: 123-45-6789";
    const expected = ssnRedactor.redact(input);

    for (const size of [4096, 8192, 16384]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });

  test("large input (100 KiB) with match at start across chunks", async () => {
    const input = "SSN: 123-45-6789" + "x".repeat(102400);
    const expected = ssnRedactor.redact(input);

    for (const size of [4096, 8192, 16384]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });

  test("single chunk near buffer limit (60000 chars)", async () => {
    const input = "x".repeat(60000) + "SSN: 123-45-6789";
    const expected = ssnRedactor.redact(input);

    async function* chunks(): AsyncIterable<string> {
      yield input;
    }
    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe(expected);
  });

  test("empty stream emits only complete event", async () => {
    async function* chunks(): AsyncIterable<string> {}
    const events = await collectEvents(ssnRedactor.stream(chunks()));
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("complete");
  });
});

describe("v0: following-label context across chunks", () => {
  test("SSN number in one chunk, following label in next", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "123-45-6789";
      yield " (SSN)";
    }
    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe("[US_SSN] (SSN)");
  });

  test("SSN with following label split at various points", async () => {
    const input = "123-45-6789 (SSN)";
    const expected = ssnRedactor.redact(input);

    for (const splitPoint of [1, 5, 11, 12, 13, 14, 15]) {
      async function* chunks(): AsyncIterable<string> {
        yield input.slice(0, splitPoint);
        yield input.slice(splitPoint);
      }
      const output = await collectText(ssnRedactor.stream(chunks()));
      expect(output).toBe(expected);
    }
  });

  test("SSN with following label and padding across chunks", async () => {
    const padding = "x".repeat(100);
    const input = `${padding}123-45-6789 (SSN)${padding}`;
    const expected = ssnRedactor.redact(input);

    for (const size of [1, 16, 64, 256, 4096]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });

  test("SSN with following non-parenthesized label across chunks", async () => {
    async function* chunks(): AsyncIterable<string> {
      yield "123-45-6789";
      yield " SSN";
    }
    const output = await collectText(ssnRedactor.stream(chunks()));
    expect(output).toBe("[US_SSN] SSN");
  });
});

describe("v0: invalid candidates in streaming", () => {
  test("structurally invalid SSN 000 area passes through", async () => {
    const input = "SSN: 000-45-6789";
    const expected = ssnRedactor.redact(input);

    for (const size of [1, 16, 256]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
      expect(output).toBe(input);
    }
  });

  test("structurally invalid SSN 666 area passes through", async () => {
    const input = "SSN: 666-12-3456";
    const expected = ssnRedactor.redact(input);

    for (const size of [1, 16, 256]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
      expect(output).toBe(input);
    }
  });

  test("structurally invalid SSN 900 area passes through", async () => {
    const input = "SSN: 900-12-3456";
    const expected = ssnRedactor.redact(input);

    for (const size of [1, 16, 256]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
      expect(output).toBe(input);
    }
  });

  test("structurally invalid SSN 00 middle group passes through", async () => {
    const input = "SSN: 123-00-6789";
    const expected = ssnRedactor.redact(input);

    for (const size of [1, 16, 256]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
      expect(output).toBe(input);
    }
  });

  test("structurally invalid SSN 0000 last group passes through", async () => {
    const input = "SSN: 123-45-0000";
    const expected = ssnRedactor.redact(input);

    for (const size of [1, 16, 256]) {
      const output = await collectText(
        ssnRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
      expect(output).toBe(input);
    }
  });

  test("invalid card failed Luhn passes through", async () => {
    const input = "Card: 4242 4242 4242 4241";
    const expected = cardRedactor.redact(input);

    for (const size of [1, 16, 256]) {
      const output = await collectText(
        cardRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
      expect(output).toBe(input);
    }
  });

  test("invalid card all same digit passes through", async () => {
    const input = "Card: 4444 4444 4444 4444";
    const expected = cardRedactor.redact(input);

    for (const size of [1, 16, 256]) {
      const output = await collectText(
        cardRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
      expect(output).toBe(input);
    }
  });

  test("invalid card too few digits passes through", async () => {
    const input = "Card: 4242 4242 4242";
    const expected = cardRedactor.redact(input);

    for (const size of [1, 16, 256]) {
      const output = await collectText(
        cardRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
      expect(output).toBe(input);
    }
  });

  test("invalid SSN and invalid card together pass through", async () => {
    const input = "SSN: 000-45-6789 Card: 4242 4242 4242 4241";
    const expected = mixedRedactor.redact(input);

    for (const size of [1, 16, 256]) {
      const output = await collectText(
        mixedRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
      expect(output).toBe(input);
    }
  });

  test("valid and invalid candidates mixed in stream", async () => {
    const input =
      "SSN: 123-45-6789 SSN: 000-45-6789 Card: 4242 4242 4242 4242 Card: 4242 4242 4242 4241";
    const expected = mixedRedactor.redact(input);

    for (const size of [1, 16, 256, 4096]) {
      const output = await collectText(
        mixedRedactor.stream(toChunks(input, size)),
      );
      expect(output).toBe(expected);
    }
  });
});
