import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { postal_code: { action: "redact" } },
});

describe("postal_code complete-string processing", () => {
  test.each([
    ["12345", "[POSTAL_CODE]"],
    ["ZIP: 12345", "ZIP: [POSTAL_CODE]"],
    ["12345-6789", "[POSTAL_CODE]"],
    ["ZIP: 12345-6789", "ZIP: [POSTAL_CODE]"],
    ["SW1A 1AA", "[POSTAL_CODE]"],
    ["Postcode: SW1A 1AA", "Postcode: [POSTAL_CODE]"],
    ["M1 1AA", "[POSTAL_CODE]"],
    ["Postcode: M1 1AA", "Postcode: [POSTAL_CODE]"],
    ["B33 8TH", "[POSTAL_CODE]"],
    ["CR2 6XH", "[POSTAL_CODE]"],
    ["DN55 1PT", "[POSTAL_CODE]"],
    ["SW1A1AA", "[POSTAL_CODE]"],
    ["M11AA", "[POSTAL_CODE]"],
    ["K1A 1A1", "[POSTAL_CODE]"],
    ["Postal Code: K1A 1A1", "Postal Code: [POSTAL_CODE]"],
    ["K1A1A1", "[POSTAL_CODE]"],
    ["M5V 3A8", "[POSTAL_CODE]"],
    ["2000", "[POSTAL_CODE]"],
    ["Postcode: 2000", "Postcode: [POSTAL_CODE]"],
    ["10115", "[POSTAL_CODE]"],
    ["PLZ: 10115", "PLZ: [POSTAL_CODE]"],
    ["12345 and 67890", "[POSTAL_CODE] and [POSTAL_CODE]"],
    [
      "ZIP: 12345-6789 and ZIP: 54321-9876",
      "ZIP: [POSTAL_CODE] and ZIP: [POSTAL_CODE]",
    ],
    ["SW1A 1AA and M1 1AA", "[POSTAL_CODE] and [POSTAL_CODE]"],
    ["K1A 1A1 and M5V 3A8", "[POSTAL_CODE] and [POSTAL_CODE]"],
    ["12345.", "[POSTAL_CODE]."],
    ["(12345)", "([POSTAL_CODE])"],
    ["12345,", "[POSTAL_CODE],"],
    ["12345;", "[POSTAL_CODE];"],
    ["sw1a 1aa", "[POSTAL_CODE]"],
    ["k1a 1a1", "[POSTAL_CODE]"],
    ["m1 1aa", "[POSTAL_CODE]"],
    ["ZIP:12345", "ZIP:[POSTAL_CODE]"],
    ["12345-6789.", "[POSTAL_CODE]."],
    ["ZIP 12345 ZIP 67890", "ZIP [POSTAL_CODE] ZIP [POSTAL_CODE]"],
    ["1234-5678", "[POSTAL_CODE]-[POSTAL_CODE]"],
    ["1234 5678 9012", "[POSTAL_CODE] [POSTAL_CODE] [POSTAL_CODE]"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["123456", "6 digits — too long for \\d{5}, too short for \\d{5}-\\d{4}"],
    ["123", "3 digits — too short"],
    ["1234567890", "10 digits without hyphen"],
    ["12345-67890", "5 digits after hyphen"],
    ["SW1A 1A", "UK postcode too short — only 1 letter at end"],
    ["SW1A 1AAA", "UK postcode too long — 3 letters at end"],
    ["1SW 1AA", "UK postcode starts with digit"],
    ["SW 1AA", "UK postcode missing digit after letters"],
    ["K1A 1A", "CA postal code too short"],
    ["K1A 1A11", "CA postal code too long"],
    ["1K1 1A1", "CA postal code starts with digit"],
    ["K1A A1A", "CA postal code letter where digit expected"],
    ["x12345", "letter before ZIP"],
    ["12345x", "letter after ZIP"],
    ["Order12345", "letter before ZIP no space"],
    ["12345abc", "letters after ZIP no space"],
    ["xSW1A 1AA", "letter before UK postcode"],
    ["SW1A 1AAx", "letter after UK postcode"],
    ["xK1A 1A1", "letter before CA postal code"],
    ["K1A 1A1x", "letter after CA postal code"],
    ["12345_", "underscore after ZIP"],
    ["_12345", "underscore before ZIP"],
    ["12345\u0301", "combining mark after ZIP"],
    ["\ud835\udfd912345", "Unicode number before ZIP"],
    ["12345\ud835\udfd9", "Unicode number after ZIP"],
    ["1234567", "7 digits"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("ZIP: 12345");
    expect(result.text).toBe("ZIP: [POSTAL_CODE]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "12345",
      ruleId: "postal_code",
      entityType: "postal_code",
      reasons: ["postal_code.format"],
    });
    expect(result.groups[0]?.start).toBe(5);
    expect(result.groups[0]?.end).toBe(10);
  });

  test("inspection for ZIP+4 format", () => {
    const result = redactor.inspect("ZIP: 12345-6789");
    expect(result.text).toBe("ZIP: [POSTAL_CODE]");
    expect(result.groups[0]?.matches[0]?.value).toBe("12345-6789");
    expect(result.groups[0]?.start).toBe(5);
    expect(result.groups[0]?.end).toBe(15);
  });

  test("inspection for UK postcode", () => {
    const result = redactor.inspect("Postcode: SW1A 1AA");
    expect(result.text).toBe("Postcode: [POSTAL_CODE]");
    expect(result.groups[0]?.matches[0]?.value).toBe("SW1A 1AA");
  });

  test("inspection for CA postal code", () => {
    const result = redactor.inspect("Postal Code: K1A 1A1");
    expect(result.text).toBe("Postal Code: [POSTAL_CODE]");
    expect(result.groups[0]?.matches[0]?.value).toBe("K1A 1A1");
  });

  test("mask preserves first 2 graphemes", () => {
    const masker = createRedactor({
      rules: {
        postal_code: { action: "mask", preserve: { first: 2 } },
      },
    });
    expect(masker.redact("ZIP: 12345")).toBe("ZIP: 12***");
    expect(masker.redact("ZIP: 12345-6789")).toBe("ZIP: 12********");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { postal_code: { action: "remove" } },
    });
    expect(remover.redact("ZIP: 12345")).toBe("ZIP: ");
    expect(remover.redact("12345-6789")).toBe("");
  });

  test("coexists with email detector", () => {
    const both = createRedactor({
      rules: {
        email: { action: "redact" },
        postal_code: { action: "redact" },
      },
    });
    expect(both.redact("Email: alice@example.com ZIP: 12345")).toBe(
      "Email: [EMAIL] ZIP: [POSTAL_CODE]",
    );
  });

  test("coexists with address detector", () => {
    const both = createRedactor({
      rules: {
        address: { action: "redact" },
        postal_code: { action: "redact" },
      },
    });
    expect(both.redact("Address: 123 Main St, Springfield, IL 62701")).toBe(
      "Address: [ADDRESS], Springfield, IL [POSTAL_CODE]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { postal_code: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.postal_code)).toBe(true);
    expect(instance.policy.postal_code).not.toBe(config.rules.postal_code);
  });

  test("postal_code off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { postal_code: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown postal_code rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { postal_code: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });

  test("4-digit AU postcode at boundary", () => {
    expect(redactor.redact("2000")).toBe("[POSTAL_CODE]");
    expect(redactor.redact("x2000")).toBe("x2000");
    expect(redactor.redact("2000x")).toBe("2000x");
  });

  test("5-digit US ZIP at boundary", () => {
    expect(redactor.redact("12345")).toBe("[POSTAL_CODE]");
    expect(redactor.redact("x12345")).toBe("x12345");
    expect(redactor.redact("12345x")).toBe("12345x");
  });

  test("10-digit ZIP+4 at maxMatchLength boundary", () => {
    expect(redactor.redact("12345-6789")).toBe("[POSTAL_CODE]");
    expect(redactor.redact("x12345-6789")).toBe("x12345-6789");
    expect(redactor.redact("12345-6789x")).toBe("12345-6789x");
  });

  test("UK postcode without space at boundary", () => {
    expect(redactor.redact("SW1A1AA")).toBe("[POSTAL_CODE]");
    expect(redactor.redact("M11AA")).toBe("[POSTAL_CODE]");
  });

  test("CA postal code without space at boundary", () => {
    expect(redactor.redact("K1A1A1")).toBe("[POSTAL_CODE]");
    expect(redactor.redact("M5V3A8")).toBe("[POSTAL_CODE]");
  });

  test("long sequence of digits does not match", () => {
    const long = "1".repeat(20);
    expect(redactor.redact(long)).toBe(long);
  });

  test("Unicode emoji does not break detection", () => {
    const result = redactor.redact("😀 12345");
    expect(result).toBe("😀 [POSTAL_CODE]");
  });

  test("multiple postal codes in sequence", () => {
    const result = redactor.redact("12345 67890 11111 22222");
    expect(result).toBe(
      "[POSTAL_CODE] [POSTAL_CODE] [POSTAL_CODE] [POSTAL_CODE]",
    );
  });

  test("mixed format postal codes", () => {
    const result = redactor.redact("12345 SW1A 1AA K1A 1A1 2000");
    expect(result).toBe(
      "[POSTAL_CODE] [POSTAL_CODE] [POSTAL_CODE] [POSTAL_CODE]",
    );
  });
});
