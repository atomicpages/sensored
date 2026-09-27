import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { passport: { action: "redact" } },
});

describe("passport complete-string processing", () => {
  test.each([
    ["Passport: 123456789", "Passport: [PASSPORT]"],
    ["Passport No.: AB123456", "Passport No.: [PASSPORT]"],
    ["Passport Number: AB1234567", "Passport Number: [PASSPORT]"],
    ["passport: 123456789", "passport: [PASSPORT]"],
    ["PASSPORT: AB123456", "PASSPORT: [PASSPORT]"],
    [
      "Passport: 987654321 and Passport No.: AB123456",
      "Passport: [PASSPORT] and Passport No.: [PASSPORT]",
    ],
    ["before Passport: 123456789 after", "before Passport: [PASSPORT] after"],
    ["Passport: 123456789.", "Passport: [PASSPORT]."],
    ["(Passport: 123456789)", "(Passport: [PASSPORT])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["123456789", "no context"],
    ["AB123456", "no context"],
    ["My number is 123456789", "wrong context"],
    ["Passport: 12345678", "8 digits, wrong"],
    ["Passport: AB12345", "2+5, wrong"],
    ["Passport: AB12345678", "2+8, wrong"],
    ["x123456789", "embedded"],
    ["123456789x", "embedded"],
    ["_123456789", "embedded underscore"],
    ["123456789_", "embedded underscore"],
    ["Passport: 1234567890", "10 digits, too long"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Passport: 123456789");
    expect(result.text).toBe("Passport: [PASSPORT]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "123456789",
      ruleId: "passport",
      entityType: "passport",
      reasons: ["passport.format", "passport.context"],
    });
    expect(result.groups[0]?.start).toBe(10);
    expect(result.groups[0]?.end).toBe(19);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        passport: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("Passport: 123456789")).toBe("Passport: *****6789");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { passport: { action: "remove" } },
    });
    expect(remover.redact("Passport: 123456789")).toBe("Passport: ");
  });

  test("coexists with email detector", () => {
    const both = createRedactor({
      rules: {
        email: { action: "redact" },
        passport: { action: "redact" },
      },
    });
    expect(both.redact("Email: alice@example.com Passport: 123456789")).toBe(
      "Email: [EMAIL] Passport: [PASSPORT]",
    );
  });

  test("multiple passports in text", () => {
    expect(redactor.redact("Passport: 123456789 Passport No.: AB123456")).toBe(
      "Passport: [PASSPORT] Passport No.: [PASSPORT]",
    );
  });

  test("emoji before candidate does not shift alignment", () => {
    expect(redactor.redact("\ud83d\ude00 Passport: 123456789")).toBe(
      "\ud83d\ude00 Passport: [PASSPORT]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { passport: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.passport)).toBe(true);
    expect(instance.policy.passport).not.toBe(config.rules.passport);
  });

  test("passport off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { passport: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown passport rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { passport: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
