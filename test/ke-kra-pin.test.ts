import { describe, expect, test } from "bun:test";
import { emailDetector } from "../src/detectors/contact/email";
import { keKraPinDetector } from "../src/detectors/national-id/ke-kra-pin";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: keKraPinDetector, setting: { action: "redact" } },
]);

describe("Kenya KRA PIN complete-string processing", () => {
  test.each([
    ["KRA: A123456789B", "KRA: [KE_KRA_PIN]"],
    ["Kenya: A123456789B", "Kenya: [KE_KRA_PIN]"],
    ["Revenue: A123456789B", "Revenue: [KE_KRA_PIN]"],
    ["Authority: A123456789B", "Authority: [KE_KRA_PIN]"],
    ["Tax: A123456789B", "Tax: [KE_KRA_PIN]"],
    ["PIN: A123456789B", "PIN: [KE_KRA_PIN]"],
    ["Taxpayer: A123456789B", "Taxpayer: [KE_KRA_PIN]"],
    ["KRA:A123456789B", "KRA:[KE_KRA_PIN]"],
    ["KRA# A123456789B", "KRA# [KE_KRA_PIN]"],
    ["KRA#A123456789B", "KRA#[KE_KRA_PIN]"],
    ["A123456789B (KRA)", "[KE_KRA_PIN] (KRA)"],
    ["A123456789B KRA", "[KE_KRA_PIN] KRA"],
    ["A123456789B (Kenya)", "[KE_KRA_PIN] (Kenya)"],
    ["A123456789B (PIN)", "[KE_KRA_PIN] (PIN)"],
    ["kra: A123456789B", "kra: [KE_KRA_PIN]"],
    ["TAX: A123456789B", "TAX: [KE_KRA_PIN]"],
    ["KRA:        A123456789B", "KRA:        [KE_KRA_PIN]"],
    ["KRA:\tA123456789B", "KRA:\t[KE_KRA_PIN]"],
    ["KRA: \t A123456789B", "KRA: \t [KE_KRA_PIN]"],
    ["A123456789B\t(KRA)", "[KE_KRA_PIN]\t(KRA)"],
    ["A123456789B        (KRA)", "[KE_KRA_PIN]        (KRA)"],
    [
      "KRA: A123456789B and KRA: A987654321C",
      "KRA: [KE_KRA_PIN] and KRA: [KE_KRA_PIN]",
    ],
    ["KRA: A123456789B.", "KRA: [KE_KRA_PIN]."],
    ["(KRA: A123456789B)", "(KRA: [KE_KRA_PIN])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: A123456789B", "non-approved label"],
    ["A123456789B", "no label"],
    ["myKRA: A123456789B", "label not whole — my prefix"],
    ["KRAx: A123456789B", "label not whole — x suffix"],
    ["KRA:\nA123456789B", "newline between label and candidate"],
    ["KRA:         A123456789B", "9 spaces exceeds 0-8"],
    ["A123456789B(KRA)", "0 spaces before paren — following requires 1-8"],
    ["A123456789B (KRA", "missing closing paren"],
    ["A123456789Bx (KRA)", "letter after candidate before following label"],
    ["KRA: B123456789B", "does not start with A"],
    ["KRA: A12345678B", "only 8 digits"],
    ["KRA: A1234567890B", "10 digits"],
    ["KRA: A123456789", "no trailing letter"],
    ["KRA: A123456789b", "lowercase trailing letter"],
    ["KRA: A123456789B_", "underscore after candidate"],
    ["_KRA: A123456789B", "underscore before label"],
    ["KRA: A123456789B\u0301", "combining mark after candidate"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("KRA: A123456789B");
    expect(result.text).toBe("KRA: [KE_KRA_PIN]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "A123456789B",
      ruleId: "ke_kra_pin",
      entityType: "ke_kra_pin",
      reasons: ["ke_kra_pin.format", "ke_kra_pin.context"],
    });
    expect(result.groups[0]?.start).toBe(5);
    expect(result.groups[0]?.end).toBe(16);
  });

  test("inspection for following context", () => {
    const result = redactor.inspect("A123456789B (KRA)");
    expect(result.text).toBe("[KE_KRA_PIN] (KRA)");
    expect(result.groups[0]?.matches[0]?.value).toBe("A123456789B");
    expect(result.groups[0]?.start).toBe(0);
    expect(result.groups[0]?.end).toBe(11);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor([
      {
        detector: keKraPinDetector,
        setting: { action: "mask", preserve: { last: 4 } },
      },
    ]);
    expect(masker.redact("KRA: A123456789B")).toBe("KRA: *******789B");
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor([
      { detector: keKraPinDetector, setting: { action: "remove" } },
    ]);
    expect(remover.redact("KRA: A123456789B")).toBe("KRA: ");
    expect(remover.redact("A123456789B (KRA)")).toBe(" (KRA)");
  });

  test("coexists with email detector", () => {
    const both = makeRedactor([
      { detector: emailDetector, setting: { action: "redact" } },
      { detector: keKraPinDetector, setting: { action: "redact" } },
    ]);
    expect(both.redact("Email: alice@example.com KRA: A123456789B")).toBe(
      "Email: [EMAIL] KRA: [KE_KRA_PIN]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const setting = { action: "redact" as const };
    const instance = makeRedactor([{ detector: keKraPinDetector, setting }]);
    expect(Object.isFrozen(instance.policy.ke_kra_pin)).toBe(true);
    expect(instance.policy.ke_kra_pin).not.toBe(setting);
  });
});
