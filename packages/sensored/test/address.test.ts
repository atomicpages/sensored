import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { address: { action: "redact" } },
});

describe("address complete-string processing", () => {
  test.each([
    ["Address: 123 Main St", "Address: [ADDRESS]"],
    ["Address: 123 Main Street", "Address: [ADDRESS]"],
    ["Address: 42 Baker Street", "Address: [ADDRESS]"],
    ["Address: 100 Pennsylvania Avenue", "Address: [ADDRESS]"],
    ["Home Address: 10 Downing Street", "Home Address: [ADDRESS]"],
    ["Mailing Address: 123 Park Ave", "Mailing Address: [ADDRESS]"],
    ["Mailing Address: 123 Park Avenue", "Mailing Address: [ADDRESS]"],
    ["Residence: 45 Elm Rd", "Residence: [ADDRESS]"],
    ["Residence: 45 Elm Road", "Residence: [ADDRESS]"],
    ["Postal Address: 789 Pine Dr", "Postal Address: [ADDRESS]"],
    ["Postal Address: 789 Pine Drive", "Postal Address: [ADDRESS]"],
    ["Street: 500 Oak Lane", "Street: [ADDRESS]"],
    ["Street: 500 Oak Ln", "Street: [ADDRESS]"],
    ["Address: 321 Maple Ct", "Address: [ADDRESS]"],
    ["Address: 321 Maple Court", "Address: [ADDRESS]"],
    ["Address: 654 Cedar Pl", "Address: [ADDRESS]"],
    ["Address: 654 Cedar Place", "Address: [ADDRESS]"],
    ["Address: 111 River Way", "Address: [ADDRESS]"],
    ["Address: 222 Birch Blvd", "Address: [ADDRESS]"],
    ["Address: 222 Birch Boulevard", "Address: [ADDRESS]"],
    ["Address: 333 Walnut Sq", "Address: [ADDRESS]"],
    ["Address: 333 Walnut Square", "Address: [ADDRESS]"],
    ["Address: 444 Cherry Ter", "Address: [ADDRESS]"],
    ["Address: 444 Cherry Terrace", "Address: [ADDRESS]"],
    ["Address: 555 Willow Cir", "Address: [ADDRESS]"],
    ["Address: 555 Willow Circle", "Address: [ADDRESS]"],
    ["Address: 666 Aspen Pkwy", "Address: [ADDRESS]"],
    ["Address: 666 Aspen Parkway", "Address: [ADDRESS]"],
    ["Address: 777 Elm Hwy", "Address: [ADDRESS]"],
    ["Address: 777 Elm Highway", "Address: [ADDRESS]"],
    ["Address: 999 West 42nd St", "Address: [ADDRESS]"],
    ["Address: 123 Main St, Springfield", "Address: [ADDRESS], Springfield"],
    ["Address: 123 Main St; Springfield", "Address: [ADDRESS]; Springfield"],
    ["Address: 123 Main St.", "Address: [ADDRESS]."],
    ["Address: 1 Wilson Blvd", "Address: [ADDRESS]"],
    ["Address: 123456 West Main St", "Address: [ADDRESS]"],
    ["Address: 123 North South St", "Address: [ADDRESS]"],
    ["123 Main St (Address)", "[ADDRESS] (Address)"],
    ["123 Main Street (Address)", "[ADDRESS] (Address)"],
    ["123 Main St Address", "[ADDRESS] Address"],
    ["123 Main St (Home Address)", "[ADDRESS] (Home Address)"],
    ["123 Main St (Mailing Address)", "[ADDRESS] (Mailing Address)"],
    ["123 Main St (Residence)", "[ADDRESS] (Residence)"],
    ["123 Main St (Postal Address)", "[ADDRESS] (Postal Address)"],
    ["123 Main St (Street)", "[ADDRESS] (Street)"],
    ["address: 123 main st", "address: [ADDRESS]"],
    ["ADDRESS: 123 MAIN ST", "ADDRESS: [ADDRESS]"],
    ["Address:123 Main St", "Address:[ADDRESS]"],
    ["Address# 123 Main St", "Address# [ADDRESS]"],
    ["Address#123 Main St", "Address#[ADDRESS]"],
    ["Address:  123 Main St", "Address:  [ADDRESS]"],
    ["Address:\t123 Main St", "Address:\t[ADDRESS]"],
    ["Address: \t 123 Main St", "Address: \t [ADDRESS]"],
    ["123 Main St\t(Address)", "[ADDRESS]\t(Address)"],
    ["123 Main St        (Address)", "[ADDRESS]        (Address)"],
    [
      "Address: 123 Main St and Address: 456 Oak St",
      "Address: [ADDRESS] and Address: [ADDRESS]",
    ],
    ["(Address: 123 Main St)", "(Address: [ADDRESS])"],
    ["Address: 123 O'Brien Street", "Address: [ADDRESS]"],
    ["Address: 123 Park-Avenue Ave", "Address: [ADDRESS]"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Meet me at 123 Main St", "no context label"],
    ["123 Main St", "no context label"],
    ["123 Main", "no suffix"],
    ["Main St", "no number"],
    ["Address: 123 Main Stx", "letter after suffix"],
    ["Address: 123Main St", "no space after number"],
    ["Address: 123 Main", "no suffix with context"],
    ["Address: Main St", "no number with context"],
    ["Reference: 123 Main St", "non-approved label"],
    ["myAddress: 123 Main St", "label not whole — my prefix"],
    ["Addressx: 123 Main St", "label not whole — x suffix"],
    ["Address:\n123 Main St", "newline between label and candidate"],
    ["123 Main St (Reference)", "non-approved following label"],
    ["Address: 123 Main St123", "digit after suffix"],
    ["Address: 1234567 Main St", "7 digit number exceeds \\d{1,6}"],
    ["Address: 123 Main St\ud835\udfd9", "Unicode number after suffix"],
    ["Address: \ud835\udfd9123 Main St", "Unicode number before number"],
    ["Address: 123 Main St_", "underscore after suffix"],
    ["_Address: 123 Main St", "underscore before label"],
    ["Address: 123 Main St\u0301", "combining mark after suffix"],
    ["Address: 123 Main Stlight", "suffix embedded in larger word"],
    ["Address: 123 Main Streetlight", "suffix embedded in larger word 2"],
    ["Address: 123 Main Plaza", "Pl is not Place — Plaza"],
    ["x123 Main St (Address)", "letter before number with following context"],
    [
      "Address: 123 Main Stx (Address)",
      "letter after suffix with following context",
    ],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Address: 123 Main St");
    expect(result.text).toBe("Address: [ADDRESS]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "123 Main St",
      ruleId: "address",
      entityType: "address",
      reasons: ["address.format", "address.context"],
    });
    expect(result.groups[0]?.start).toBe(9);
    expect(result.groups[0]?.end).toBe(20);
  });

  test("inspection for long suffix", () => {
    const result = redactor.inspect("Address: 100 Pennsylvania Avenue");
    expect(result.text).toBe("Address: [ADDRESS]");
    expect(result.groups[0]?.matches[0]?.value).toBe("100 Pennsylvania Avenue");
  });

  test("inspection for following context", () => {
    const result = redactor.inspect("123 Main St (Address)");
    expect(result.text).toBe("[ADDRESS] (Address)");
    expect(result.groups[0]?.matches[0]?.value).toBe("123 Main St");
    expect(result.groups[0]?.start).toBe(0);
    expect(result.groups[0]?.end).toBe(11);
  });

  test("mask preserves first 3 graphemes", () => {
    const masker = createRedactor({
      rules: {
        address: { action: "mask", preserve: { first: 3 } },
      },
    });
    expect(masker.redact("Address: 123 Main St")).toBe("Address: 123********");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { address: { action: "remove" } },
    });
    expect(remover.redact("Address: 123 Main St")).toBe("Address: ");
    expect(remover.redact("123 Main St (Address)")).toBe(" (Address)");
  });

  test("coexists with email detector", () => {
    const both = createRedactor({
      rules: {
        email: { action: "redact" },
        address: { action: "redact" },
      },
    });
    expect(both.redact("Email: alice@example.com Address: 123 Main St")).toBe(
      "Email: [EMAIL] Address: [ADDRESS]",
    );
  });

  test("coexists with postal_code detector", () => {
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
      rules: { address: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.address)).toBe(true);
    expect(instance.policy.address).not.toBe(config.rules.address);
  });

  test("address off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { address: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown address rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { address: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });

  test("long address near maxMatchLength boundary", () => {
    const longName = "North South East West";
    const input = `Address: 123 ${longName} St`;
    const result = redactor.redact(input);
    expect(result).toContain("[ADDRESS]");
  });

  test("address with Unicode emoji does not break", () => {
    const result = redactor.redact("😀 Address: 123 Main St");
    expect(result).toBe("😀 Address: [ADDRESS]");
  });

  test("overlapping address candidates only match first", () => {
    const result = redactor.redact("Address: 123 Main St Address: 456 Oak St");
    expect(result).toBe("Address: [ADDRESS] Address: [ADDRESS]");
  });
});
