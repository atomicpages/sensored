import { describe, expect, test } from "bun:test";
import { emailDetector } from "../src/detectors/contact/email";
import { maIdDetector } from "../src/detectors/national-id/ma-id";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: maIdDetector, setting: { action: "redact" } },
]);

describe("Morocco CNIE complete-string processing", () => {
  test.each([
    ["National ID: AB123456", "National ID: [MA_ID]"],
    ["National ID: A1234567", "National ID: [MA_ID]"],
    ["National ID: 12345678", "National ID: [MA_ID]"],
    ["National ID: AB12345678", "National ID: [MA_ID]"],
    ["National ID: A12345678", "National ID: [MA_ID]"],
    ["Identity: AB123456", "Identity: [MA_ID]"],
    ["Morocco: AB123456", "Morocco: [MA_ID]"],
    ["Moroccan: AB123456", "Moroccan: [MA_ID]"],
    ["CNIE: AB123456", "CNIE: [MA_ID]"],
    ["National ID:AB123456", "National ID:[MA_ID]"],
    ["National ID# AB123456", "National ID# [MA_ID]"],
    ["National ID#AB123456", "National ID#[MA_ID]"],
    ["AB123456 (National ID)", "[MA_ID] (National ID)"],
    ["AB123456 National ID", "[MA_ID] National ID"],
    ["AB123456 (Morocco)", "[MA_ID] (Morocco)"],
    ["AB123456 (CNIE)", "[MA_ID] (CNIE)"],
    ["national id: AB123456", "national id: [MA_ID]"],
    ["MOROCCO: AB123456", "MOROCCO: [MA_ID]"],
    ["National ID:        AB123456", "National ID:        [MA_ID]"],
    ["National ID:\tAB123456", "National ID:\t[MA_ID]"],
    ["National ID: \t AB123456", "National ID: \t [MA_ID]"],
    ["AB123456\t(National ID)", "[MA_ID]\t(National ID)"],
    ["AB123456        (CNIE)", "[MA_ID]        (CNIE)"],
    [
      "National ID: AB123456 and National ID: CD789012",
      "National ID: [MA_ID] and National ID: [MA_ID]",
    ],
    ["National ID: AB123456.", "National ID: [MA_ID]."],
    ["(National ID: AB123456)", "(National ID: [MA_ID])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: AB123456", "non-approved label"],
    ["AB123456", "no label"],
    ["myNational ID: AB123456", "label not whole — my prefix"],
    ["National IDx: AB123456", "label not whole — x suffix"],
    ["National ID:\nAB123456", "newline between label and candidate"],
    ["National ID:         AB123456", "9 spaces exceeds 0-8"],
    ["AB123456(National ID)", "0 spaces before paren — following requires 1-8"],
    ["AB123456 (National ID", "missing closing paren"],
    [
      "AB123456x (National ID)",
      "letter after candidate before following label",
    ],
    ["National ID: AB12345_", "underscore in candidate"],
    ["National ID: AB123456_", "underscore after candidate"],
    ["_National ID: AB123456", "underscore before label"],
    ["National ID: AB123456\u0301", "combining mark after candidate"],
    ["National ID: ABC123456", "3 letters — too many for pattern"],
    ["National ID: 1234567", "7 digits only — too few for \\d{8}"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("National ID: AB123456");
    expect(result.text).toBe("National ID: [MA_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "AB123456",
      ruleId: "ma_id",
      entityType: "ma_id",
      reasons: ["ma_id.format", "ma_id.context"],
    });
    expect(result.groups[0]?.start).toBe(13);
    expect(result.groups[0]?.end).toBe(21);
  });

  test("inspection for following context", () => {
    const result = redactor.inspect("AB123456 (National ID)");
    expect(result.text).toBe("[MA_ID] (National ID)");
    expect(result.groups[0]?.matches[0]?.value).toBe("AB123456");
    expect(result.groups[0]?.start).toBe(0);
    expect(result.groups[0]?.end).toBe(8);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor([
      {
        detector: maIdDetector,
        setting: { action: "mask", preserve: { last: 4 } },
      },
    ]);
    expect(masker.redact("National ID: AB123456")).toBe(
      "National ID: ****3456",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor([
      { detector: maIdDetector, setting: { action: "remove" } },
    ]);
    expect(remover.redact("National ID: AB123456")).toBe("National ID: ");
    expect(remover.redact("AB123456 (National ID)")).toBe(" (National ID)");
  });

  test("coexists with email detector", () => {
    const both = makeRedactor([
      { detector: emailDetector, setting: { action: "redact" } },
      { detector: maIdDetector, setting: { action: "redact" } },
    ]);
    expect(both.redact("Email: alice@example.com National ID: AB123456")).toBe(
      "Email: [EMAIL] National ID: [MA_ID]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const setting = { action: "redact" as const };
    const instance = makeRedactor([{ detector: maIdDetector, setting }]);
    expect(Object.isFrozen(instance.policy.ma_id)).toBe(true);
    expect(instance.policy.ma_id).not.toBe(setting);
  });
});
