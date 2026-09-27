import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { nl_bsn: { action: "redact" } },
});

describe("nl-bsn complete-string processing", () => {
  test.each([
    ["BSN: 111222333", "BSN: [NL_BSN]"],
    ["BSN: 123456782", "BSN: [NL_BSN]"],
    ["BSN: 100000009", "BSN: [NL_BSN]"],
    ["Burgerservicenummer: 111222333", "Burgerservicenummer: [NL_BSN]"],
    ["Dutch ID: 123456782", "Dutch ID: [NL_BSN]"],
    ["Citizen Service Number: 111222333", "Citizen Service Number: [NL_BSN]"],
    ["BSN: 111.222.333", "BSN: [NL_BSN]"],
    ["BSN: 123.456.782", "BSN: [NL_BSN]"],
    ["BSN 111222333 and BSN 123456782", "BSN [NL_BSN] and BSN [NL_BSN]"],
    ["BSN: 111222333.", "BSN: [NL_BSN]."],
    ["(BSN: 111222333)", "(BSN: [NL_BSN])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["111222333", "no context"],
    ["123.456.789", "invalid checksum (dotted)"],
    ["123456789", "invalid checksum (compact)"],
    ["11122233", "8 digits (too short)"],
    ["1112223334", "10 digits (too long)"],
    ["111222333extra", "embedded in letter after"],
    ["extra111222333", "embedded in letter before"],
    ["111222333_", "embedded in underscore after"],
    ["_111222333", "embedded in underscore before"],
    ["111222333\u0301", "embedded in combining mark after"],
    ["my111222333file", "embedded in word"],
    ["BSN: 123456789", "invalid checksum with context"],
    ["BSN: 11122233", "too short with context"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("trailing period is preserved", () => {
    expect(redactor.redact("BSN: 111222333.")).toBe("BSN: [NL_BSN].");
  });

  test("leading punctuation is preserved", () => {
    expect(redactor.redact("BSN: 111222333]")).toBe("BSN: [NL_BSN]]");
  });

  test("multiple BSNs with mixed formats", () => {
    expect(redactor.redact("BSN 111222333 and BSN 123.456.782")).toBe(
      "BSN [NL_BSN] and BSN [NL_BSN]",
    );
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("BSN: 111222333");
    expect(result.text).toBe("BSN: [NL_BSN]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "111222333",
      ruleId: "nl_bsn",
      entityType: "nl_bsn",
      reasons: ["nl_bsn.checksum", "nl_bsn.context"],
    });
    expect(result.groups[0]?.start).toBe(5);
    expect(result.groups[0]?.end).toBe(14);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        nl_bsn: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("BSN: 111222333")).toBe("BSN: *****2333");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { nl_bsn: { action: "remove" } },
    });
    expect(remover.redact("BSN: 111222333")).toBe("BSN: ");
  });

  test("coexists with payment_card detector", () => {
    const both = createRedactor({
      rules: {
        nl_bsn: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(both.redact("BSN 111222333 Card 4242424242424242")).toBe(
      "BSN [NL_BSN] Card [PAYMENT_CARD]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { nl_bsn: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.nl_bsn)).toBe(true);
    expect(instance.policy.nl_bsn).not.toBe(config.rules.nl_bsn);
  });

  test("nl_bsn off with no other rules throws", () => {
    expect(() =>
      createRedactor({
        rules: { nl_bsn: "off" },
      }),
    ).toThrow(SensoredError);
  });

  test("dotted format with context", () => {
    expect(redactor.redact("Burgerservicenummer: 111.222.333")).toBe(
      "Burgerservicenummer: [NL_BSN]",
    );
  });
});
