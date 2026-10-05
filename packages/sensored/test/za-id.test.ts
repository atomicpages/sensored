import { describe, expect, test } from "bun:test";
import { emailDetector } from "../src/detectors/contact/email";
import { zaIdDetector } from "../src/detectors/national-id/za-id";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: zaIdDetector, setting: { action: "redact" } },
]);

describe("South Africa ID complete-string processing", () => {
  test.each([
    ["National ID: 9001015000080", "National ID: [ZA_ID]"],
    ["Identity: 9001015000080", "Identity: [ZA_ID]"],
    ["ID Number: 9001015000080", "ID Number: [ZA_ID]"],
    ["South Africa: 9001015000080", "South Africa: [ZA_ID]"],
    ["RSA: 9001015000080", "RSA: [ZA_ID]"],
    ["ZA: 9001015000080", "ZA: [ZA_ID]"],
    ["National ID:9001015000080", "National ID:[ZA_ID]"],
    ["National ID# 9001015000080", "National ID# [ZA_ID]"],
    ["National ID#9001015000080", "National ID#[ZA_ID]"],
    ["9001015000080 (National ID)", "[ZA_ID] (National ID)"],
    ["9001015000080 National ID", "[ZA_ID] National ID"],
    ["9001015000080 (South Africa)", "[ZA_ID] (South Africa)"],
    ["9001015000080 (Identity)", "[ZA_ID] (Identity)"],
    ["9001015000080 (ID Number)", "[ZA_ID] (ID Number)"],
    ["national id: 9001015000080", "national id: [ZA_ID]"],
    ["NATIONAL ID: 9001015000080", "NATIONAL ID: [ZA_ID]"],
    ["National ID:        9001015000080", "National ID:        [ZA_ID]"],
    ["National ID:\t9001015000080", "National ID:\t[ZA_ID]"],
    ["National ID: \t 9001015000080", "National ID: \t [ZA_ID]"],
    ["9001015000080\t(National ID)", "[ZA_ID]\t(National ID)"],
    ["9001015000080        (ZA)", "[ZA_ID]        (ZA)"],
    [
      "National ID: 9001015000080 and National ID: 8502156000091",
      "National ID: [ZA_ID] and National ID: [ZA_ID]",
    ],
    ["National ID: 9001015000080.", "National ID: [ZA_ID]."],
    ["(National ID: 9001015000080)", "(National ID: [ZA_ID])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["National ID: 9000015000080", "invalid month 00"],
    ["National ID: 9013015000080", "invalid month 13"],
    ["National ID: 9001005000080", "invalid day 00"],
    ["National ID: 9001325000080", "invalid day 32"],
    ["Reference: 9001015000080", "non-approved label"],
    ["9001015000080", "no label"],
    ["myNational ID: 9001015000080", "label not whole — my prefix"],
    ["National IDx: 9001015000080", "label not whole — x suffix"],
    ["National ID:\n9001015000080", "newline between label and candidate"],
    ["National ID:         9001015000080", "9 spaces exceeds 0-8"],
    [
      "9001015000080(National ID)",
      "0 spaces before paren — following requires 1-8",
    ],
    ["9001015000080 (National ID", "missing closing paren"],
    [
      "9001015000080x (National ID)",
      "letter after candidate before following label",
    ],
    ["National ID: 90010150000800", "digit after candidate"],
    ["National ID: 09001015000080", "digit before candidate"],
    ["National ID: 9001015000080_", "underscore after candidate"],
    ["_National ID: 9001015000080", "underscore before label"],
    ["National ID: 9001015000080\u0301", "combining mark after candidate"],
    ["National ID: 900101500008", "12 digits — too few"],
    ["National ID: 90010150000800", "14 digits — too many"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("National ID: 9001015000080");
    expect(result.text).toBe("National ID: [ZA_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "9001015000080",
      ruleId: "za_id",
      entityType: "za_id",
      reasons: ["za_id.structure", "za_id.context"],
    });
    expect(result.groups[0]?.start).toBe(13);
    expect(result.groups[0]?.end).toBe(26);
  });

  test("inspection for following context", () => {
    const result = redactor.inspect("9001015000080 (National ID)");
    expect(result.text).toBe("[ZA_ID] (National ID)");
    expect(result.groups[0]?.matches[0]?.value).toBe("9001015000080");
    expect(result.groups[0]?.start).toBe(0);
    expect(result.groups[0]?.end).toBe(13);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor([
      {
        detector: zaIdDetector,
        setting: { action: "mask", preserve: { last: 4 } },
      },
    ]);
    expect(masker.redact("National ID: 9001015000080")).toBe(
      "National ID: *********0080",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor([
      { detector: zaIdDetector, setting: { action: "remove" } },
    ]);
    expect(remover.redact("National ID: 9001015000080")).toBe("National ID: ");
    expect(remover.redact("9001015000080 (National ID)")).toBe(
      " (National ID)",
    );
  });

  test("coexists with email detector", () => {
    const both = makeRedactor([
      { detector: emailDetector, setting: { action: "redact" } },
      { detector: zaIdDetector, setting: { action: "redact" } },
    ]);
    expect(
      both.redact("Email: alice@example.com National ID: 9001015000080"),
    ).toBe("Email: [EMAIL] National ID: [ZA_ID]");
  });

  test("policy is a frozen snapshot", () => {
    const setting = { action: "redact" as const };
    const instance = makeRedactor([{ detector: zaIdDetector, setting }]);
    expect(Object.isFrozen(instance.policy.za_id)).toBe(true);
    expect(instance.policy.za_id).not.toBe(setting);
  });
});
