import { describe, expect, test } from "bun:test";
import { emailDetector } from "../src/detectors/contact/email";
import { keIdDetector } from "../src/detectors/national-id/ke-id";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: keIdDetector, setting: { action: "redact" } },
]);

describe("Kenya National ID complete-string processing", () => {
  test.each([
    ["National ID: 1234567", "National ID: [KE_ID]"],
    ["National ID: 12345678", "National ID: [KE_ID]"],
    ["Identity: 1234567", "Identity: [KE_ID]"],
    ["Kenya: 1234567", "Kenya: [KE_ID]"],
    ["Kenyan: 1234567", "Kenyan: [KE_ID]"],
    ["National ID:1234567", "National ID:[KE_ID]"],
    ["National ID# 1234567", "National ID# [KE_ID]"],
    ["National ID#1234567", "National ID#[KE_ID]"],
    ["1234567 (National ID)", "[KE_ID] (National ID)"],
    ["1234567 National ID", "[KE_ID] National ID"],
    ["1234567 (Kenya)", "[KE_ID] (Kenya)"],
    ["1234567 (Identity)", "[KE_ID] (Identity)"],
    ["national id: 1234567", "national id: [KE_ID]"],
    ["KENYA: 1234567", "KENYA: [KE_ID]"],
    ["National ID:        1234567", "National ID:        [KE_ID]"],
    ["National ID:\t1234567", "National ID:\t[KE_ID]"],
    ["National ID: \t 1234567", "National ID: \t [KE_ID]"],
    ["1234567\t(National ID)", "[KE_ID]\t(National ID)"],
    ["1234567        (Kenya)", "[KE_ID]        (Kenya)"],
    [
      "National ID: 1234567 and National ID: 8765432",
      "National ID: [KE_ID] and National ID: [KE_ID]",
    ],
    ["National ID: 1234567.", "National ID: [KE_ID]."],
    ["(National ID: 1234567)", "(National ID: [KE_ID])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: 1234567", "non-approved label"],
    ["1234567", "no label"],
    ["myNational ID: 1234567", "label not whole — my prefix"],
    ["National IDx: 1234567", "label not whole — x suffix"],
    ["National ID:\n1234567", "newline between label and candidate"],
    ["National ID:         1234567", "9 spaces exceeds 0-8"],
    ["1234567(National ID)", "0 spaces before paren — following requires 1-8"],
    ["1234567 (National ID", "missing closing paren"],
    ["1234567x (National ID)", "letter after candidate before following label"],
    ["National ID: 123456", "6 digits — too few"],
    ["National ID: 123456789", "9 digits — too many"],
    ["National ID: 1234567_", "underscore after candidate"],
    ["_National ID: 1234567", "underscore before label"],
    ["National ID: 1234567\u0301", "combining mark after candidate"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("National ID: 1234567");
    expect(result.text).toBe("National ID: [KE_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "1234567",
      ruleId: "ke_id",
      entityType: "ke_id",
      reasons: ["ke_id.format", "ke_id.context"],
    });
    expect(result.groups[0]?.start).toBe(13);
    expect(result.groups[0]?.end).toBe(20);
  });

  test("inspection for 8-digit ID", () => {
    const result = redactor.inspect("National ID: 12345678");
    expect(result.text).toBe("National ID: [KE_ID]");
    expect(result.groups[0]?.matches[0]?.value).toBe("12345678");
    expect(result.groups[0]?.start).toBe(13);
    expect(result.groups[0]?.end).toBe(21);
  });

  test("inspection for following context", () => {
    const result = redactor.inspect("1234567 (National ID)");
    expect(result.text).toBe("[KE_ID] (National ID)");
    expect(result.groups[0]?.matches[0]?.value).toBe("1234567");
    expect(result.groups[0]?.start).toBe(0);
    expect(result.groups[0]?.end).toBe(7);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor([
      {
        detector: keIdDetector,
        setting: { action: "mask", preserve: { last: 4 } },
      },
    ]);
    expect(masker.redact("National ID: 1234567")).toBe("National ID: ***4567");
    expect(masker.redact("National ID: 12345678")).toBe(
      "National ID: ****5678",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor([
      { detector: keIdDetector, setting: { action: "remove" } },
    ]);
    expect(remover.redact("National ID: 1234567")).toBe("National ID: ");
    expect(remover.redact("1234567 (National ID)")).toBe(" (National ID)");
  });

  test("coexists with email detector", () => {
    const both = makeRedactor([
      { detector: emailDetector, setting: { action: "redact" } },
      { detector: keIdDetector, setting: { action: "redact" } },
    ]);
    expect(both.redact("Email: alice@example.com National ID: 1234567")).toBe(
      "Email: [EMAIL] National ID: [KE_ID]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const setting = { action: "redact" as const };
    const instance = makeRedactor([{ detector: keIdDetector, setting }]);
    expect(Object.isFrozen(instance.policy.ke_id)).toBe(true);
    expect(instance.policy.ke_id).not.toBe(setting);
  });
});
