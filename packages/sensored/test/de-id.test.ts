import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { de_id: { action: "redact" } },
});

describe("de-id complete-string processing", () => {
  test.each([
    ["Personalausweis: 1234567890", "Personalausweis: [DE_ID]"],
    ["German ID: L01X0064745", "German ID: [DE_ID]"],
    ["National ID: 1234567890", "National ID: [DE_ID]"],
    ["Identity Card: ABCD1234567", "Identity Card: [DE_ID]"],
    ["Ausweis: 9876543210", "Ausweis: [DE_ID]"],
    ["Personalausweis L01X0064745", "Personalausweis [DE_ID]"],
    [
      "German ID 1234567890 and German ID L01X0064745",
      "German ID [DE_ID] and German ID [DE_ID]",
    ],
    ["German ID: 1234567890.", "German ID: [DE_ID]."],
    ["(German ID: 1234567890)", "(German ID: [DE_ID])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["1234567890", "no context"],
    ["L01X0064745", "no context (11-char)"],
    ["123456789", "9 digits (too short)"],
    ["12345678901", "11 digits (no context)"],
    ["1234567890extra", "embedded in letter after"],
    ["extra1234567890", "embedded in letter before"],
    ["1234567890_", "embedded in underscore after"],
    ["_1234567890", "embedded in underscore before"],
    ["1234567890\u0301", "embedded in combining mark after"],
    ["my1234567890file", "embedded in word"],
    ["Personalausweis: 123456789", "too short with context"],
    ["Personalausweis: 123456789012", "12 digits with context"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("trailing period is preserved", () => {
    expect(redactor.redact("Personalausweis: 1234567890.")).toBe(
      "Personalausweis: [DE_ID].",
    );
  });

  test("leading punctuation is preserved", () => {
    expect(redactor.redact("Personalausweis: 1234567890]")).toBe(
      "Personalausweis: [DE_ID]]",
    );
  });

  test("multiple IDs with mixed formats", () => {
    expect(
      redactor.redact("German ID 1234567890 and German ID L01X0064745"),
    ).toBe("German ID [DE_ID] and German ID [DE_ID]");
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Personalausweis: 1234567890");
    expect(result.text).toBe("Personalausweis: [DE_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "1234567890",
      ruleId: "de_id",
      entityType: "de_id",
      reasons: ["de_id.format", "de_id.context"],
    });
    expect(result.groups[0]?.start).toBe(17);
    expect(result.groups[0]?.end).toBe(27);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        de_id: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("Personalausweis: 1234567890")).toBe(
      "Personalausweis: ******7890",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { de_id: { action: "remove" } },
    });
    expect(remover.redact("Personalausweis: 1234567890")).toBe(
      "Personalausweis: ",
    );
  });

  test("coexists with payment_card detector", () => {
    const both = createRedactor({
      rules: {
        de_id: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(both.redact("German ID 1234567890 Card 4242424242424242")).toBe(
      "German ID [DE_ID] Card [PAYMENT_CARD]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { de_id: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.de_id)).toBe(true);
    expect(instance.policy.de_id).not.toBe(config.rules.de_id);
  });

  test("de_id off with no other rules throws", () => {
    expect(() =>
      createRedactor({
        rules: { de_id: "off" },
      }),
    ).toThrow(SensoredError);
  });

  test("long digit sequence does not match", () => {
    expect(redactor.redact("Personalausweis: 12345678901234567890")).toBe(
      "Personalausweis: 12345678901234567890",
    );
  });

  test("Unicode context label", () => {
    expect(redactor.redact("Ausweis: L01X0064745")).toBe("Ausweis: [DE_ID]");
  });
});
