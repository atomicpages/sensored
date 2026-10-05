import { describe, expect, test } from "bun:test";
import { trIdDetector } from "../src/detectors/national-id/tr-id";
import { processText } from "../src/engine";
import type { ActiveRule, RuleSetting } from "../src/types";

function makeRedactor(setting: RuleSetting) {
  const rules: ActiveRule[] = [{ detector: trIdDetector, setting }];
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

describe("Turkey TC Kimlik complete-string processing", () => {
  test.each([
    ["Turkey National ID: 12345678901", "Turkey National ID: [TR_ID]"],
    ["Turkish Kimlik: 23456789012", "Turkish Kimlik: [TR_ID]"],
    ["TC Kimlik: 34567890123", "TC Kimlik: [TR_ID]"],
    ["National ID: 12345678901", "National ID: [TR_ID]"],
    ["Turkey National ID:12345678901", "Turkey National ID:[TR_ID]"],
    ["Turkey National ID# 12345678901", "Turkey National ID# [TR_ID]"],
    ["12345678901 (Turkey)", "[TR_ID] (Turkey)"],
    ["12345678901 (National ID)", "[TR_ID] (National ID)"],
    ["turkey national id: 12345678901", "turkey national id: [TR_ID]"],
    ["TURKEY NATIONAL ID: 12345678901", "TURKEY NATIONAL ID: [TR_ID]"],
    ["Turkey National ID: 12345678901.", "Turkey National ID: [TR_ID]."],
    ["(Turkey National ID: 12345678901)", "(Turkey National ID: [TR_ID])"],
    [
      "Turkey National ID: 12345678901 and Turkey National ID: 23456789012",
      "Turkey National ID: [TR_ID] and Turkey National ID: [TR_ID]",
    ],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: 12345678901", "non-approved label"],
    ["12345678901", "no label"],
    ["myTurkey: 12345678901", "label not whole — my prefix"],
    ["Turkeyx: 12345678901", "label not whole — x suffix"],
    ["Turkey National ID: 1234567890", "10 digits"],
    ["Turkey National ID: 123456789012", "12 digits"],
    ["Turkey National ID: 02345678901", "starts with 0"],
    ["Turkey National ID: 12345678901_", "underscore after candidate"],
    ["_Turkey: 12345678901", "underscore before label"],
    ["Turkey National ID: 12345678901x", "letter after candidate"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Turkey National ID: 12345678901");
    expect(result.text).toBe("Turkey National ID: [TR_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "12345678901",
      ruleId: "tr_id",
      entityType: "tr_id",
      reasons: ["tr_id.format", "tr_id.context"],
    });
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor({ action: "mask", preserve: { last: 4 } });
    expect(masker.redact("Turkey National ID: 12345678901")).toBe(
      "Turkey National ID: *******8901",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor({ action: "remove" });
    expect(remover.redact("Turkey National ID: 12345678901")).toBe(
      "Turkey National ID: ",
    );
  });
});
