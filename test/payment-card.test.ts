import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { payment_card: { action: "redact" } },
});

describe("payment-card complete-string processing", () => {
  test.each([
    ["4242424242424242", "[PAYMENT_CARD]"],
    ["4242 4242 4242 4242", "[PAYMENT_CARD]"],
    ["4242-4242-4242-4242", "[PAYMENT_CARD]"],
    ["378282246310005", "[PAYMENT_CARD]"],
    ["3782 822463 10005", "[PAYMENT_CARD]"],
    ["4222222222222", "[PAYMENT_CARD]"],
    ["4242424242424242428", "[PAYMENT_CARD]"],
    ["4242 4242 4242 4242 428", "[PAYMENT_CARD]"],
    ["4-2-4-2-4-2-4-2-4-2-4-2-4-2-4-2-4-2-8", "[PAYMENT_CARD]"],
    ["Card: 4242 4242 4242 4242", "Card: [PAYMENT_CARD]"],
    [
      "4242424242424242 and 378282246310005",
      "[PAYMENT_CARD] and [PAYMENT_CARD]",
    ],
    ["before 4242424242424242 after", "before [PAYMENT_CARD] after"],
    ["4242424242424242.", "[PAYMENT_CARD]."],
    ["(4242424242424242)", "([PAYMENT_CARD])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["4242 4242 4242 4241", "bad Luhn"],
    ["42424242424242424242", "20 digits, too many"],
    ["4242424242424", "13 digits, bad Luhn"],
    ["0000000000000", "all same digit"],
    ["4242 4242-4242-4242", "mixed separators"],
    ["4242424242424242extra", "embedded in letter after"],
    ["extra4242424242424242", "embedded in letter before"],
    ["\ud835\udfd9424242424242424242", "embedded in number before (surrogate)"],
    ["4242424242424242\ud835\udfd9", "embedded in number after (surrogate)"],
    ["4242424242424242_", "embedded in underscore after"],
    ["_4242424242424242", "embedded in underscore before"],
    ["4242424242424242\u0301", "embedded in combining mark after"],
    ["1234567 4242424242424242", "group > 6 digits, no substring extraction"],
    ["4242424242424242 4242", "20 digits with space, no substring extraction"],
    [
      "4242 4242 4242 4242 4242",
      "20 digits with spaces, no substring extraction",
    ],
    ["1234567 4242424242424242 4242", "group > 6 and too many digits"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Card: 4242 4242 4242 4242");
    expect(result.text).toBe("Card: [PAYMENT_CARD]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "4242 4242 4242 4242",
      ruleId: "payment_card",
      entityType: "payment_card",
      reasons: ["payment_card.luhn", "payment_card.format"],
    });
    expect(result.groups[0]?.start).toBe(6);
    expect(result.groups[0]?.end).toBe(25);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        payment_card: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("4242424242424242")).toBe("************4242");
    expect(masker.redact("4242 4242 4242 4242")).toBe("***************4242");
    expect(masker.redact("4242-4242-4242-4242")).toBe("***************4242");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { payment_card: { action: "remove" } },
    });
    expect(remover.redact("Card: 4242424242424242")).toBe("Card: ");
    expect(remover.redact("4242424242424242")).toBe("");
  });

  test("coexists with email detector", () => {
    const both = createRedactor({
      rules: {
        email: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(both.redact("Email: alice@example.com Card: 4242424242424242")).toBe(
      "Email: [EMAIL] Card: [PAYMENT_CARD]",
    );
  });

  test("overlapping email and card fall back to [REDACTED]", () => {
    const both = createRedactor({
      rules: {
        email: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(both.redact("alice@4242-4242-4242-4242.com")).toBe("[REDACTED]");
  });

  test("remove wins over redact in overlap", () => {
    const mixed = createRedactor({
      rules: {
        email: { action: "redact" },
        payment_card: { action: "remove" },
      },
    });
    expect(mixed.redact("alice@4242-4242-4242-4242.com")).toBe("");
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { payment_card: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.payment_card)).toBe(true);
    expect(instance.policy.payment_card).not.toBe(config.rules.payment_card);
  });

  test("payment_card off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { payment_card: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown payment rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { payment_card: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
