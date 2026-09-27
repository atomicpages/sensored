import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { ca_sin: { action: "redact" } },
});

describe("ca-sin complete-string processing", () => {
  test.each([
    ["046-454-286", "[CA_SIN]"],
    ["046454286", "[CA_SIN]"],
    ["123-456-782", "[CA_SIN]"],
    ["123456782", "[CA_SIN]"],
    ["SIN: 046-454-286", "SIN: [CA_SIN]"],
    ["SIN: 046454286", "SIN: [CA_SIN]"],
    ["046-454-286 and 123-456-782", "[CA_SIN] and [CA_SIN]"],
    ["046454286 and 123456782", "[CA_SIN] and [CA_SIN]"],
    ["before 046-454-286 after", "before [CA_SIN] after"],
    ["046-454-286.", "[CA_SIN]."],
    ["(046-454-286)", "([CA_SIN])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["123-456-789", "invalid Luhn (hyphenated)"],
    ["123456789", "invalid Luhn (compact)"],
    ["046-454-28", "8 digits (hyphenated)"],
    ["04645428", "8 digits (compact)"],
    ["046-454-2860", "10 digits (hyphenated)"],
    ["0464542860", "10 digits (compact)"],
    ["046454286extra", "embedded in letter after"],
    ["extra046454286", "embedded in letter before"],
    ["046454286_", "embedded in underscore after"],
    ["_046454286", "embedded in underscore before"],
    ["046454286\u0301", "embedded in combining mark after"],
    ["\ud835\udfd9046454286", "embedded in number before (surrogate)"],
    ["046454286\ud835\udfd9", "embedded in number after (surrogate)"],
    ["my046-454-286file", "embedded in word"],
    ["123-456-7890", "phone-like number (10 digits, invalid Luhn)"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("trailing period is preserved", () => {
    expect(redactor.redact("SIN: 046-454-286.")).toBe("SIN: [CA_SIN].");
  });

  test("leading punctuation is preserved", () => {
    expect(redactor.redact("[046-454-286]")).toBe("[[CA_SIN]]");
  });

  test("multiple SINs with mixed formats", () => {
    expect(redactor.redact("046-454-286 and 123456782")).toBe(
      "[CA_SIN] and [CA_SIN]",
    );
  });

  test("SIN mixed with other text", () => {
    expect(redactor.redact("The employee SIN 046-454-286 is valid.")).toBe(
      "The employee SIN [CA_SIN] is valid.",
    );
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("SIN: 046-454-286");
    expect(result.text).toBe("SIN: [CA_SIN]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "046-454-286",
      ruleId: "ca_sin",
      entityType: "ca_sin",
      reasons: ["ca_sin.luhn", "ca_sin.format"],
    });
    expect(result.groups[0]?.start).toBe(5);
    expect(result.groups[0]?.end).toBe(16);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        ca_sin: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("046-454-286")).toBe("*******-286");
    expect(masker.redact("046454286")).toBe("*****4286");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { ca_sin: { action: "remove" } },
    });
    expect(remover.redact("SIN: 046-454-286")).toBe("SIN: ");
    expect(remover.redact("046454286")).toBe("");
  });

  test("coexists with payment_card detector", () => {
    const both = createRedactor({
      rules: {
        ca_sin: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(both.redact("SIN 046-454-286 Card 4242424242424242")).toBe(
      "SIN [CA_SIN] Card [PAYMENT_CARD]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { ca_sin: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.ca_sin)).toBe(true);
    expect(instance.policy.ca_sin).not.toBe(config.rules.ca_sin);
  });

  test("ca_sin off with no other rules throws", () => {
    expect(() =>
      createRedactor({
        rules: { ca_sin: "off" },
      }),
    ).toThrow(SensoredError);
  });
});
