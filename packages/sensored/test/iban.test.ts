import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { iban: { action: "redact" } },
});

describe("iban complete-string processing", () => {
  test.each([
    ["GB82 WEST 1234 5698 7654 32", "[IBAN]"],
    ["DE89 3704 0044 0532 0130 00", "[IBAN]"],
    ["FR14 2004 1010 0505 0001 3M02 606", "[IBAN]"],
    ["IT60 X054 2811 1010 0000 0123 456", "[IBAN]"],
    ["NL91 ABNA 0417 1643 00", "[IBAN]"],
    ["BE68 5390 0754 7034", "[IBAN]"],
    ["CH93 0076 2011 6238 5295 7", "[IBAN]"],
    ["AT61 1904 3002 3457 3201", "[IBAN]"],
    ["ES91 2100 0418 4502 0005 1332", "[IBAN]"],
    ["SE45 5000 0000 0583 9825 7466", "[IBAN]"],
    ["NO93 8601 1117 947", "[IBAN]"],
    ["MT33 MALT 0110 0123 4567 8901 2345 600", "[IBAN]"],
    ["GB82WEST12345698765432", "[IBAN]"],
    ["DE89370400440532013000", "[IBAN]"],
    ["NL91ABNA0417164300", "[IBAN]"],
    ["BE68539007547034", "[IBAN]"],
    ["NO9386011117947", "[IBAN]"],
    ["IBAN: GB82 WEST 1234 5698 7654 32", "IBAN: [IBAN]"],
    ["GB82 WEST 1234 5698 7654 32.", "[IBAN]."],
    ["(GB82 WEST 1234 5698 7654 32)", "([IBAN])"],
    [
      "GB82 WEST 1234 5698 7654 32 and DE89 3704 0044 0532 0130 00",
      "[IBAN] and [IBAN]",
    ],
    ["before GB82 WEST 1234 5698 7654 32 after", "before [IBAN] after"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["GB82 WEST 1234 5698 7654 33", "invalid mod-97 checksum"],
    ["DE89 3704 0044 0532 0130 01", "invalid mod-97 checksum DE"],
    ["XX12 3456 7890", "wrong country code"],
    ["GB82 1234", "too short for GB"],
    ["GB82 WEST 1234 5698 7654 32 12", "too long for GB"],
    ["1234567890", "regular account number"],
    ["+44 20 7946 0958", "phone number"],
    ["xGB82WEST12345698765432x", "embedded in word characters"],
    ["_GB82WEST12345698765432", "embedded in underscore before"],
    ["GB82WEST12345698765432_", "embedded in underscore after"],
    ["GB82WEST12345698765432\u0301", "embedded in combining mark after"],
    [
      "\ud835\udfd9GB82WEST12345698765432",
      "embedded in number before (surrogate)",
    ],
    [
      "GB82WEST12345698765432\ud835\udfd9",
      "embedded in number after (surrogate)",
    ],
    ["AB12CD34EF56", "non-SEPA country code AB"],
    ["GB82", "no BBAN after check digits"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("trailing period is preserved", () => {
    expect(redactor.redact("IBAN: GB82 WEST 1234 5698 7654 32.")).toBe(
      "IBAN: [IBAN].",
    );
  });

  test("comma after candidate is preserved", () => {
    expect(
      redactor.redact(
        "GB82 WEST 1234 5698 7654 32, DE89 3704 0044 0532 0130 00",
      ),
    ).toBe("[IBAN], [IBAN]");
  });

  test("multiple IBANs in text", () => {
    expect(
      redactor.redact(
        "First: GB82 WEST 1234 5698 7654 32, Second: DE89 3704 0044 0532 0130 00",
      ),
    ).toBe("First: [IBAN], Second: [IBAN]");
  });

  test("emoji before candidate does not shift alignment", () => {
    expect(redactor.redact("\ud83d\ude00 GB82 WEST 1234 5698 7654 32")).toBe(
      "\ud83d\ude00 [IBAN]",
    );
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("IBAN: GB82 WEST 1234 5698 7654 32");
    expect(result.text).toBe("IBAN: [IBAN]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "GB82 WEST 1234 5698 7654 32",
      ruleId: "iban",
      entityType: "iban",
      reasons: ["iban.checksum", "iban.format"],
    });
    expect(result.groups[0]?.start).toBe(6);
    expect(result.groups[0]?.end).toBe(33);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: { iban: { action: "mask", preserve: { last: 4 } } },
    });
    expect(masker.redact("GB82 WEST 1234 5698 7654 32")).toBe(
      "***********************4 32",
    );
  });

  test("mask preserves last 4 graphemes compact", () => {
    const masker = createRedactor({
      rules: { iban: { action: "mask", preserve: { last: 4 } } },
    });
    expect(masker.redact("GB82WEST12345698765432")).toBe(
      "******************5432",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { iban: { action: "remove" } },
    });
    expect(remover.redact("IBAN: GB82 WEST 1234 5698 7654 32")).toBe("IBAN: ");
    expect(remover.redact("GB82 WEST 1234 5698 7654 32")).toBe("");
  });

  test("coexists with payment_card detector", () => {
    const both = createRedactor({
      rules: {
        iban: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(
      both.redact("IBAN: GB82 WEST 1234 5698 7654 32 Card: 4242424242424242"),
    ).toBe("IBAN: [IBAN] Card: [PAYMENT_CARD]");
  });

  test("policy is a frozen snapshot", () => {
    const config = { rules: { iban: { action: "redact" as const } } };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.iban)).toBe(true);
    expect(instance.policy.iban).not.toBe(config.rules.iban);
  });

  test("iban off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { iban: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown iban rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { iban: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
