import { describe, expect, it, test } from "bun:test";
import { createRedactor, type StreamEvent } from "../src";

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

describe("format-preserve: streaming equivalence", () => {
  const redactor = createRedactor({
    rules: {
      email: { action: "format-preserve" },
      payment_card: { action: "format-preserve" },
      us_ssn: { action: "format-preserve" },
    },
  });

  test.each([
    ["Contact john@example.com", 1],
    ["Contact john@example.com", 3],
    ["Contact john@example.com", 7],
    ["Card 4111-1111-1111-1111", 1],
    ["Card 4111-1111-1111-1111", 5],
    ["SSN 123-45-6789", 1],
    ["SSN 123-45-6789", 4],
    ["email john@example.com card 4111111111111111 ssn 123-45-6789", 1],
    ["email john@example.com card 4111111111111111 ssn 123-45-6789", 3],
    ["email john@example.com card 4111111111111111 ssn 123-45-6789", 10],
  ])(
    "streaming matches complete-string for %j (chunk=%j)",
    async (text, size) => {
      const expected = redactor.redact(text);
      const stream = redactor.stream(toChunks(text, size));
      const result = await collectText(stream);
      expect(result).toBe(expected);
    },
  );
});

describe("token-replace: streaming equivalence", () => {
  const redactor = createRedactor({
    rules: {
      email: { action: "token-replace" },
      payment_card: { action: "token-replace" },
      us_ssn: { action: "token-replace" },
    },
  });

  test.each([
    ["Contact john@example.com", 1],
    ["Contact john@example.com", 3],
    ["Contact john@example.com", 7],
    ["Card 4111111111111111", 1],
    ["Card 4111111111111111", 5],
    ["SSN 123-45-6789", 1],
    ["SSN 123-45-6789", 4],
    ["email john@example.com card 4111111111111111 ssn 123-45-6789", 1],
    ["email john@example.com card 4111111111111111 ssn 123-45-6789", 3],
    ["email john@example.com card 4111111111111111 ssn 123-45-6789", 10],
  ])(
    "streaming matches complete-string for %j (chunk=%j)",
    async (text, size) => {
      const expected = redactor.redact(text);
      const stream = redactor.stream(toChunks(text, size));
      const result = await collectText(stream);
      expect(result).toBe(expected);
    },
  );
});

describe("format-preserve: full pipeline with mixed actions", () => {
  const redactor = createRedactor({
    rules: {
      email: { action: "format-preserve" },
      payment_card: { action: "redact" },
      us_ssn: { action: "remove" },
      phone: { action: "mask", preserve: { first: 2, last: 4 } },
    },
  });

  it("applies correct action per entity", () => {
    const result = redactor.redact(
      "email john@example.com card 4111111111111111 ssn 123-45-6789 phone 415-555-1234",
    );
    expect(result).toBe(
      "email ****@*******.*** card [PAYMENT_CARD] ssn  phone 41******1234",
    );
  });
});

describe("token-replace: full pipeline with mixed actions", () => {
  const redactor = createRedactor({
    rules: {
      email: { action: "token-replace" },
      payment_card: { action: "redact" },
      us_ssn: { action: "remove" },
      phone: { action: "mask", preserve: { first: 2, last: 4 } },
    },
  });

  it("applies correct action per entity", () => {
    const result = redactor.redact(
      "email john@example.com card 4111111111111111 ssn 123-45-6789 phone 415-555-1234",
    );
    expect(result).toBe(
      "email redacted@example card [PAYMENT_CARD] ssn  phone 41******1234",
    );
  });
});

describe("format-preserve and token-replace: inspect", () => {
  it("inspect reports format-preserve replacements", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "format-preserve" },
      },
    });

    const result = redactor.inspect("Contact john@example.com");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.replacement).toBe("****@*******.***");
    expect(result.groups[0]?.matches[0]?.value).toBe("john@example.com");
  });

  it("inspect reports token-replace replacements", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "token-replace" },
      },
    });

    const result = redactor.inspect("Contact john@example.com");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.replacement).toBe("redacted@example");
    expect(result.groups[0]?.matches[0]?.value).toBe("john@example.com");
  });
});
