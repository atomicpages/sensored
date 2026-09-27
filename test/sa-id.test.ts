import { describe, expect, test } from "bun:test";
import { saIdDetector } from "../src/detectors/national-id/sa-id";
import { processText } from "../src/engine";
import type { ActiveRule, RuleSetting } from "../src/types";

function makeRedactor(setting: RuleSetting) {
  const rules: ActiveRule[] = [{ detector: saIdDetector, setting }];
  return {
    redact(text: string): string {
      return processText(text, rules, false).text;
    },
    inspect(text: string) {
      return processText(text, rules, true);
    },
  };
}

const redactor = makeRedactor({ action: "redact" });

describe("Saudi Arabia National ID complete-string processing", () => {
  test.each([
    ["Saudi National ID: 1234567890", "Saudi National ID: [SA_ID]"],
    ["KSA Iqama: 2345678901", "KSA Iqama: [SA_ID]"],
    ["Kingdom: 1987654321", "Kingdom: [SA_ID]"],
    ["Muqeem: 1234567890", "Muqeem: [SA_ID]"],
    ["National ID: 2345678901", "National ID: [SA_ID]"],
    ["Saudi National ID:1234567890", "Saudi National ID:[SA_ID]"],
    ["Saudi National ID# 1234567890", "Saudi National ID# [SA_ID]"],
    ["1234567890 (Saudi)", "[SA_ID] (Saudi)"],
    ["1234567890 (National ID)", "[SA_ID] (National ID)"],
    ["saudi national id: 1234567890", "saudi national id: [SA_ID]"],
    ["SAUDI NATIONAL ID: 1234567890", "SAUDI NATIONAL ID: [SA_ID]"],
    ["Saudi National ID: 1234567890.", "Saudi National ID: [SA_ID]."],
    ["(Saudi National ID: 1234567890)", "(Saudi National ID: [SA_ID])"],
    [
      "Saudi National ID: 1234567890 and Saudi National ID: 2345678901",
      "Saudi National ID: [SA_ID] and Saudi National ID: [SA_ID]",
    ],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: 1234567890", "non-approved label"],
    ["1234567890", "no label"],
    ["mySaudi: 1234567890", "label not whole — my prefix"],
    ["Saudix: 1234567890", "label not whole — x suffix"],
    ["Saudi National ID: 12345678901", "11 digits"],
    ["Saudi National ID: 123456789", "9 digits"],
    ["Saudi National ID: 3234567890", "starts with 3"],
    ["Saudi National ID: 0234567890", "starts with 0"],
    ["Saudi National ID: 1234567890_", "underscore after candidate"],
    ["_Saudi: 1234567890", "underscore before label"],
    ["Saudi National ID: 1234567890x", "letter after candidate"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Saudi National ID: 1234567890");
    expect(result.text).toBe("Saudi National ID: [SA_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "1234567890",
      ruleId: "sa_id",
      entityType: "sa_id",
      reasons: ["sa_id.format", "sa_id.context"],
    });
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor({ action: "mask", preserve: { last: 4 } });
    expect(masker.redact("Saudi National ID: 1234567890")).toBe(
      "Saudi National ID: ******7890",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor({ action: "remove" });
    expect(remover.redact("Saudi National ID: 1234567890")).toBe(
      "Saudi National ID: ",
    );
  });
});
