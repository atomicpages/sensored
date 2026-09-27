import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { jp_my_number: { action: "redact" } },
});

describe("jp-my-number complete-string processing", () => {
  test.each([
    ["123456789018", "[JP_MY_NUMBER]"],
    ["1234 5678 9018", "[JP_MY_NUMBER]"],
    ["My Number: 123456789018", "My Number: [JP_MY_NUMBER]"],
    ["My Number: 1234 5678 9018", "My Number: [JP_MY_NUMBER]"],
    ["123456789018 and 1234 5678 9018", "[JP_MY_NUMBER] and [JP_MY_NUMBER]"],
    ["before 123456789018 after", "before [JP_MY_NUMBER] after"],
    ["123456789018.", "[JP_MY_NUMBER]."],
    ["(123456789018)", "([JP_MY_NUMBER])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["123456789012", "invalid checksum"],
    ["1234 5678 9012", "invalid checksum spaced"],
    ["12345678901", "11 digits"],
    ["1234567890123", "13 digits"],
    ["123456789018extra", "embedded in letter after"],
    ["extra123456789018", "embedded in letter before"],
    ["123456789018_", "embedded in underscore after"],
    ["_123456789018", "embedded in underscore before"],
    ["123456789018\u0301", "embedded in combining mark after"],
    ["\ud835\udfd9123456789018", "embedded in number before (surrogate)"],
    ["123456789018\ud835\udfd9", "embedded in number after (surrogate)"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("My Number: 1234 5678 9018");
    expect(result.text).toBe("My Number: [JP_MY_NUMBER]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "1234 5678 9018",
      ruleId: "jp_my_number",
      entityType: "jp_my_number",
      reasons: ["jp_my_number.checksum", "jp_my_number.format"],
    });
    expect(result.groups[0]?.start).toBe(11);
    expect(result.groups[0]?.end).toBe(25);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        jp_my_number: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("123456789018")).toBe("********9018");
    expect(masker.redact("1234 5678 9018")).toBe("**********9018");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { jp_my_number: { action: "remove" } },
    });
    expect(remover.redact("My Number: 123456789018")).toBe("My Number: ");
    expect(remover.redact("123456789018")).toBe("");
  });

  test("coexists with payment_card detector", () => {
    const both = createRedactor({
      rules: {
        jp_my_number: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(both.redact("Card: 4242424242424242 My Number: 123456789018")).toBe(
      "Card: [PAYMENT_CARD] My Number: [JP_MY_NUMBER]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { jp_my_number: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.jp_my_number)).toBe(true);
    expect(instance.policy.jp_my_number).not.toBe(config.rules.jp_my_number);
  });

  test("jp_my_number off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { jp_my_number: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown jp_my_number rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { jp_my_number: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
