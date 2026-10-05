import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { phone: { action: "redact" } },
});

describe("phone complete-string processing", () => {
  test.each([
    ["1234567890", "[PHONE]"],
    ["123-456-7890", "[PHONE]"],
    ["(123) 456-7890", "[PHONE]"],
    ["+11234567890", "[PHONE]"],
    ["+1 123 456 7890", "[PHONE]"],
    ["+1 (123) 456-7890", "[PHONE]"],
    ["02079460958", "[PHONE]"],
    ["020 7946 0958", "[PHONE]"],
    ["+442079460958", "[PHONE]"],
    ["+44 20 7946 0958", "[PHONE]"],
    ["+4412345678901", "[PHONE]"],
    ["0212345679", "[PHONE]"],
    ["02 1234 5679", "[PHONE]"],
    ["+61212345678", "[PHONE]"],
    ["0312345678", "[PHONE]"],
    ["03 1234 5678", "[PHONE]"],
    ["+81312345678", "[PHONE]"],
    ["Call 123-456-7890 now", "Call [PHONE] now"],
    ["123-456-7890.", "[PHONE]."],
    ["(123) 456-7890.", "[PHONE]."],
    ["123-456-7890, 098-765-4321", "[PHONE], [PHONE]"],
    ["before (123) 456-7890 after", "before [PHONE] after"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["2023-12-25", "date format YYYY-MM-DD"],
    ["12-25-2023", "date format MM-DD-YYYY"],
    ["12345", "zip code 5 digits"],
    ["123456789", "9 digits too short"],
    ["123456789012", "12 digits no plus too long"],
    ["+44123456789", "UK international too short"],
    ["+44123456789012", "UK international too long"],
    ["+6112345678", "AU international too short"],
    ["+8112345678", "JP international too short"],
    ["+23456789012", "unknown country code"],
    ["abc1234567890", "embedded in letter before"],
    ["1234567890abc", "embedded in letter after"],
    ["1234567890_", "embedded in underscore after"],
    ["_1234567890", "embedded in underscore before"],
    ["1234567890\u0301", "embedded in combining mark after"],
    ["\ud835\udfd91234567890", "embedded in number before (surrogate)"],
    ["1234567890\ud835\udfd9", "embedded in number after (surrogate)"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Call (123) 456-7890 now");
    expect(result.text).toBe("Call [PHONE] now");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "(123) 456-7890",
      ruleId: "phone",
      entityType: "phone",
      reasons: ["phone.format"],
    });
    expect(result.groups[0]?.start).toBe(5);
    expect(result.groups[0]?.end).toBe(19);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        phone: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("1234567890")).toBe("******7890");
    expect(masker.redact("(123) 456-7890")).toBe("**********7890");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { phone: { action: "remove" } },
    });
    expect(remover.redact("Call 123-456-7890 now")).toBe("Call  now");
    expect(remover.redact("123-456-7890")).toBe("");
  });

  test("coexists with email detector", () => {
    const both = createRedactor({
      rules: {
        email: { action: "redact" },
        phone: { action: "redact" },
      },
    });
    expect(both.redact("Email: alice@example.com Phone: 123-456-7890")).toBe(
      "Email: [EMAIL] Phone: [PHONE]",
    );
  });

  test("multiple phones in text", () => {
    expect(redactor.redact("123-456-7890 and 098-765-4321")).toBe(
      "[PHONE] and [PHONE]",
    );
  });

  test("emoji before candidate does not shift alignment", () => {
    expect(redactor.redact("\ud83d\ude00 123-456-7890")).toBe(
      "\ud83d\ude00 [PHONE]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { phone: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.phone)).toBe(true);
    expect(instance.policy.phone).not.toBe(config.rules.phone);
  });

  test("phone off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { phone: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown phone rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { phone: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
