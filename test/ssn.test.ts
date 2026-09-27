import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { us_ssn: { action: "redact" } },
});

describe("US SSN complete-string processing", () => {
  test.each([
    ["SSN: 123-45-6789", "SSN: [US_SSN]"],
    ["Social Security Number: 123-45-6789", "Social Security Number: [US_SSN]"],
    ["Social Security No.: 123-45-6789", "Social Security No.: [US_SSN]"],
    ["SSN:123-45-6789", "SSN:[US_SSN]"],
    ["SSN# 123-45-6789", "SSN# [US_SSN]"],
    ["SSN#123-45-6789", "SSN#[US_SSN]"],
    ["SSN: 123456789", "SSN: [US_SSN]"],
    ["Social Security Number: 123456789", "Social Security Number: [US_SSN]"],
    ["123-45-6789 (SSN)", "[US_SSN] (SSN)"],
    ["123-45-6789 SSN", "[US_SSN] SSN"],
    [
      "123-45-6789 (Social Security Number)",
      "[US_SSN] (Social Security Number)",
    ],
    ["123-45-6789 (Social Security No.)", "[US_SSN] (Social Security No.)"],
    ["123456789 (SSN)", "[US_SSN] (SSN)"],
    ["123456789 SSN", "[US_SSN] SSN"],
    ["ssn: 123-45-6789", "ssn: [US_SSN]"],
    ["SOCIAL SECURITY NUMBER: 123-45-6789", "SOCIAL SECURITY NUMBER: [US_SSN]"],
    ["social security no.: 123-45-6789", "social security no.: [US_SSN]"],
    ["SSN:        123-45-6789", "SSN:        [US_SSN]"],
    ["SSN:\t123-45-6789", "SSN:\t[US_SSN]"],
    ["SSN: \t 123-45-6789", "SSN: \t [US_SSN]"],
    ["123-45-6789\t(SSN)", "[US_SSN]\t(SSN)"],
    ["123-45-6789        (SSN)", "[US_SSN]        (SSN)"],
    [
      "SSN: 123-45-6789 and SSN: 234-56-7890",
      "SSN: [US_SSN] and SSN: [US_SSN]",
    ],
    ["SSN: 123-45-6789.", "SSN: [US_SSN]."],
    ["(SSN: 123-45-6789)", "(SSN: [US_SSN])"],
    ["SSN: 899-45-6789", "SSN: [US_SSN]"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["SSN: 000-45-6789", "first group 000"],
    ["SSN: 666-45-6789", "first group 666"],
    ["SSN: 900-45-6789", "first group 900"],
    ["SSN: 999-45-6789", "first group 999"],
    ["SSN: 123-00-6789", "middle group 00"],
    ["SSN: 123-45-0000", "last group 0000"],
    ["SSN: 000-00-0000", "all invalid groups"],
    ["Reference: 123-45-6789", "non-approved label"],
    ["123-45-6789", "no label"],
    ["mySSN: 123-45-6789", "label not whole — my prefix"],
    ["SSNx: 123-45-6789", "label not whole — x suffix"],
    ["SSN:\n123-45-6789", "newline between label and candidate"],
    ["SSN:         123-45-6789", "9 spaces exceeds 0-8"],
    ["123-45-6789(SSN)", "0 spaces before paren — following requires 1-8"],
    ["123-45-6789 (SSN", "missing closing paren"],
    ["123-45-6789 (Social Security Number", "missing closing paren long label"],
    ["123-45-6789x (SSN)", "letter after candidate before following label"],
    ["SSN: 123-45-67890", "digit after candidate"],
    ["SSN: 0123-45-6789", "digit before candidate"],
    ["\ud835\udfd9SSN: 123-45-6789", "Unicode number before label"],
    ["SSN: 123-45-6789\ud835\udfd9", "Unicode number after candidate"],
    ["SSN: 123-45-6789_", "underscore after candidate"],
    ["_SSN: 123-45-6789", "underscore before label"],
    ["SSN: 123-45-6789\u0301", "combining mark after candidate"],
    ["Social  Security Number: 123-45-6789", "double space in multiword label"],
    ["Social\tSecurity Number: 123-45-6789", "tab in multiword label"],
    ["SSN: 1234-56-789", "wrong group sizes"],
    ["SSN: 12-345-6789", "wrong group sizes 2"],
    ["SSN: 123-456-789", "wrong group sizes 3"],
    ["SSN: 123-45-678", "too few digits"],
    ["SSN: 123-45-67890", "too many digits"],
    ["SSN: 12345678", "8 digits compact"],
    ["SSN: 1234567890", "10 digits compact"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("SSN: 123-45-6789");
    expect(result.text).toBe("SSN: [US_SSN]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "123-45-6789",
      ruleId: "us_ssn",
      entityType: "us_ssn",
      reasons: ["us_ssn.structure", "us_ssn.context"],
    });
    expect(result.groups[0]?.start).toBe(5);
    expect(result.groups[0]?.end).toBe(16);
  });

  test("inspection for compact format", () => {
    const result = redactor.inspect("SSN: 123456789");
    expect(result.text).toBe("SSN: [US_SSN]");
    expect(result.groups[0]?.matches[0]?.value).toBe("123456789");
    expect(result.groups[0]?.start).toBe(5);
    expect(result.groups[0]?.end).toBe(14);
  });

  test("inspection for following context", () => {
    const result = redactor.inspect("123-45-6789 (SSN)");
    expect(result.text).toBe("[US_SSN] (SSN)");
    expect(result.groups[0]?.matches[0]?.value).toBe("123-45-6789");
    expect(result.groups[0]?.start).toBe(0);
    expect(result.groups[0]?.end).toBe(11);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        us_ssn: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("SSN: 123-45-6789")).toBe("SSN: *******6789");
    expect(masker.redact("SSN: 123456789")).toBe("SSN: *****6789");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { us_ssn: { action: "remove" } },
    });
    expect(remover.redact("SSN: 123-45-6789")).toBe("SSN: ");
    expect(remover.redact("123-45-6789 (SSN)")).toBe(" (SSN)");
  });

  test("coexists with email detector", () => {
    const both = createRedactor({
      rules: {
        email: { action: "redact" },
        us_ssn: { action: "redact" },
      },
    });
    expect(both.redact("Email: alice@example.com SSN: 123-45-6789")).toBe(
      "Email: [EMAIL] SSN: [US_SSN]",
    );
  });

  test("coexists with payment-card detector", () => {
    const both = createRedactor({
      rules: {
        payment_card: { action: "redact" },
        us_ssn: { action: "redact" },
      },
    });
    expect(both.redact("Card: 4242424242424242 SSN: 123-45-6789")).toBe(
      "Card: [PAYMENT_CARD] SSN: [US_SSN]",
    );
  });

  test("all three detectors coexist", () => {
    const all = createRedactor({
      rules: {
        email: { action: "redact" },
        payment_card: { action: "redact" },
        us_ssn: { action: "redact" },
      },
    });
    expect(
      all.redact(
        "Email: alice@example.com Card: 4242424242424242 SSN: 123-45-6789",
      ),
    ).toBe("Email: [EMAIL] Card: [PAYMENT_CARD] SSN: [US_SSN]");
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { us_ssn: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.us_ssn)).toBe(true);
    expect(instance.policy.us_ssn).not.toBe(config.rules.us_ssn);
  });

  test("us_ssn off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { us_ssn: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown us_ssn rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { us_ssn: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
