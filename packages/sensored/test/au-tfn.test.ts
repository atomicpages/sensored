import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { au_tfn: { action: "redact" } },
});

describe("au-tfn complete-string processing", () => {
  test.each([
    ["123456782", "[AU_TFN]"],
    ["123 456 782", "[AU_TFN]"],
    ["234567808", "[AU_TFN]"],
    ["234 567 808", "[AU_TFN]"],
    ["12345679", "[AU_TFN]"],
    ["100 000 06", "[AU_TFN]"],
    ["TFN: 123456782", "TFN: [AU_TFN]"],
    ["TFN: 123 456 782", "TFN: [AU_TFN]"],
    ["123456782 and 234567808", "[AU_TFN] and [AU_TFN]"],
    ["before 123456782 after", "before [AU_TFN] after"],
    ["123456782.", "[AU_TFN]."],
    ["(123456782)", "([AU_TFN])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["123456789", "invalid checksum 9-digit"],
    ["123 456 789", "invalid checksum spaced"],
    ["1234567", "7 digits too short"],
    ["1234567890", "10 digits too long"],
    ["12345678", "8 digits invalid checksum"],
    ["123456782extra", "embedded in letter after"],
    ["extra123456782", "embedded in letter before"],
    ["123456782_", "embedded in underscore after"],
    ["_123456782", "embedded in underscore before"],
    ["123456782\u0301", "embedded in combining mark after"],
    ["\ud835\udfd9123456782", "embedded in number before (surrogate)"],
    ["123456782\ud835\udfd9", "embedded in number after (surrogate)"],
    ["123 456 78", "spaced 8 digits, invalid checksum"],
    ["12 3456 782", "wrong spacing pattern"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("trailing period is preserved", () => {
    expect(redactor.redact("TFN: 123 456 782.")).toBe("TFN: [AU_TFN].");
  });

  test("comma after candidate is preserved", () => {
    expect(redactor.redact("123456782, 234567808")).toBe("[AU_TFN], [AU_TFN]");
  });

  test("multiple TFNs in text", () => {
    expect(redactor.redact("First: 123456782, Second: 234 567 808")).toBe(
      "First: [AU_TFN], Second: [AU_TFN]",
    );
  });

  test("emoji before candidate does not shift alignment", () => {
    expect(redactor.redact("\ud83d\ude00 123456782")).toBe(
      "\ud83d\ude00 [AU_TFN]",
    );
  });

  test("long digit sequence is not substring-extracted", () => {
    expect(redactor.redact("0".repeat(20))).toBe("0".repeat(20));
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("TFN: 123 456 782");
    expect(result.text).toBe("TFN: [AU_TFN]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "123 456 782",
      ruleId: "au_tfn",
      entityType: "au_tfn",
      reasons: ["au_tfn.checksum", "au_tfn.format"],
    });
    expect(result.groups[0]?.start).toBe(5);
    expect(result.groups[0]?.end).toBe(16);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        au_tfn: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("123456782")).toBe("*****6782");
    expect(masker.redact("123 456 782")).toBe("******* 782");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { au_tfn: { action: "remove" } },
    });
    expect(remover.redact("TFN: 123456782")).toBe("TFN: ");
    expect(remover.redact("123456782")).toBe("");
  });

  test("coexists with payment_card detector", () => {
    const both = createRedactor({
      rules: {
        au_tfn: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(both.redact("TFN: 123456782 Card: 4242424242424242")).toBe(
      "TFN: [AU_TFN] Card: [PAYMENT_CARD]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { au_tfn: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.au_tfn)).toBe(true);
    expect(instance.policy.au_tfn).not.toBe(config.rules.au_tfn);
  });

  test("au_tfn off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { au_tfn: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown au_tfn rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { au_tfn: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
