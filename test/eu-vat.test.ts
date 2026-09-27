import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { eu_vat: { action: "redact" } },
});

describe("eu-vat complete-string processing", () => {
  test.each([
    ["DE123456789", "[EU_VAT]"],
    ["FRAB12345678903", "[EU_VAT]"],
    ["IT12345678903", "[EU_VAT]"],
    ["ES12345678Z", "[EU_VAT]"],
    ["ES12345678", "[EU_VAT]"],
    ["NL123456782B04", "[EU_VAT]"],
    ["VAT: DE123456789", "VAT: [EU_VAT]"],
    ["VAT: FRAB12345678903", "VAT: [EU_VAT]"],
    ["VAT: IT12345678903", "VAT: [EU_VAT]"],
    ["VAT: ES12345678Z", "VAT: [EU_VAT]"],
    ["VAT: ES12345678", "VAT: [EU_VAT]"],
    ["VAT: NL123456782B04", "VAT: [EU_VAT]"],
    ["DE123456789 and FRAB12345678903", "[EU_VAT] and [EU_VAT]"],
    ["IT12345678903 and ES12345678Z", "[EU_VAT] and [EU_VAT]"],
    ["NL123456782B04 and ES12345678", "[EU_VAT] and [EU_VAT]"],
    ["before DE123456789 after", "before [EU_VAT] after"],
    ["DE123456789.", "[EU_VAT]."],
    ["(DE123456789)", "([EU_VAT])"],
    ["DE123456789, FRAB12345678903", "[EU_VAT], [EU_VAT]"],
    ["ES12345678Z.", "[EU_VAT]."],
    ["(NL123456782B04)", "([EU_VAT])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["DE12345678", "DE 8 digits too short"],
    ["DE1234567890", "DE 10 digits too long"],
    ["FRAB12345678907", "FR invalid Luhn"],
    ["IT12345678907", "IT invalid Luhn"],
    ["ES12345678X", "ES wrong check letter"],
    ["NL123456782B05", "NL wrong checksum suffix"],
    ["DE123456789extra", "embedded in letter after"],
    ["extraDE123456789", "embedded in letter before"],
    ["DE123456789_", "embedded in underscore after"],
    ["_DE123456789", "embedded in underscore before"],
    ["DE123456789\u0301", "embedded in combining mark after"],
    ["\ud835\udfd9DE123456789", "embedded in number before (surrogate)"],
    ["DE123456789\ud835\udfd9", "embedded in number after (surrogate)"],
    ["myDE123456789file", "embedded in word"],
    ["FRAB1234567890", "FR 10 digits too short"],
    ["IT1234567890", "IT 10 digits too short"],
    ["ES1234567", "ES 7 digits too short"],
    ["NL12345678B04", "NL 8 digits too short"],
    ["NL123456782C04", "NL wrong check letter (C not B)"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("trailing period is preserved", () => {
    expect(redactor.redact("VAT: DE123456789.")).toBe("VAT: [EU_VAT].");
  });

  test("leading punctuation is preserved", () => {
    expect(redactor.redact("{DE123456789}")).toBe("{[EU_VAT]}");
  });

  test("multiple VAT IDs with mixed countries", () => {
    expect(
      redactor.redact("DE123456789 and FRAB12345678903 and IT12345678903"),
    ).toBe("[EU_VAT] and [EU_VAT] and [EU_VAT]");
  });

  test("emoji before candidate does not shift alignment", () => {
    expect(redactor.redact("\ud83d\ude00 DE123456789")).toBe(
      "\ud83d\ude00 [EU_VAT]",
    );
  });

  test("ES without letter and ES with letter both detected", () => {
    expect(redactor.redact("ES12345678 and ES12345678Z")).toBe(
      "[EU_VAT] and [EU_VAT]",
    );
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("VAT: DE123456789");
    expect(result.text).toBe("VAT: [EU_VAT]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "DE123456789",
      ruleId: "eu_vat",
      entityType: "eu_vat",
    });
  });

  test("inspection shows checksum reasons for FR", () => {
    const result = redactor.inspect("VAT: FRAB12345678903");
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "FRAB12345678903",
      ruleId: "eu_vat",
      entityType: "eu_vat",
      reasons: ["eu_vat.checksum", "eu_vat.format"],
    });
  });

  test("inspection shows format-only reasons for DE", () => {
    const result = redactor.inspect("VAT: DE123456789");
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "DE123456789",
      ruleId: "eu_vat",
      entityType: "eu_vat",
      reasons: ["eu_vat.format"],
    });
  });

  test("inspection shows checksum reasons for ES with letter", () => {
    const result = redactor.inspect("VAT: ES12345678Z");
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "ES12345678Z",
      ruleId: "eu_vat",
      entityType: "eu_vat",
      reasons: ["eu_vat.checksum", "eu_vat.format"],
    });
  });

  test("inspection shows format-only reasons for ES without letter", () => {
    const result = redactor.inspect("VAT: ES12345678");
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "ES12345678",
      ruleId: "eu_vat",
      entityType: "eu_vat",
      reasons: ["eu_vat.format"],
    });
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: { eu_vat: { action: "mask", preserve: { last: 4 } } },
    });
    expect(masker.redact("DE123456789")).toBe("*******6789");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { eu_vat: { action: "remove" } },
    });
    expect(remover.redact("VAT: DE123456789")).toBe("VAT: ");
  });

  test("coexists with payment_card detector", () => {
    const both = createRedactor({
      rules: {
        eu_vat: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(both.redact("VAT: DE123456789 Card: 4242424242424242")).toBe(
      "VAT: [EU_VAT] Card: [PAYMENT_CARD]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = { rules: { eu_vat: { action: "redact" as const } } };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.eu_vat)).toBe(true);
    expect(instance.policy.eu_vat).not.toBe(config.rules.eu_vat);
  });

  test("eu_vat off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { eu_vat: "off" } })).toThrow(
      SensoredError,
    );
  });
});
