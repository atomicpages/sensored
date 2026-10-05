import { describe, expect, test } from "bun:test";
import { ilIdDetector } from "../src/detectors/national-id/il-id";
import { processText } from "../src/engine";
import type { ActiveRule, RuleSetting } from "../src/types";

function makeRedactor(setting: RuleSetting) {
  const rules: ActiveRule[] = [{ detector: ilIdDetector, setting }];
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

describe("Israel Teudat Zehut complete-string processing", () => {
  test.each([
    ["Israel National ID: 123456789", "Israel National ID: [IL_ID]"],
    ["Teudat Zehut: 987654321", "Teudat Zehut: [IL_ID]"],
    ["Israeli: 123456789", "Israeli: [IL_ID]"],
    ["National ID: 123456789", "National ID: [IL_ID]"],
    ["Israel National ID:123456789", "Israel National ID:[IL_ID]"],
    ["Israel National ID# 123456789", "Israel National ID# [IL_ID]"],
    ["123456789 (Israel)", "[IL_ID] (Israel)"],
    ["123456789 (National ID)", "[IL_ID] (National ID)"],
    ["israel national id: 123456789", "israel national id: [IL_ID]"],
    ["ISRAEL NATIONAL ID: 123456789", "ISRAEL NATIONAL ID: [IL_ID]"],
    ["Israel National ID: 123456789.", "Israel National ID: [IL_ID]."],
    ["(Israel National ID: 123456789)", "(Israel National ID: [IL_ID])"],
    [
      "Israel National ID: 123456789 and Israel National ID: 987654321",
      "Israel National ID: [IL_ID] and Israel National ID: [IL_ID]",
    ],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: 123456789", "non-approved label"],
    ["123456789", "no label"],
    ["myIsrael: 123456789", "label not whole — my prefix"],
    ["Israelx: 123456789", "label not whole — x suffix"],
    ["Israel National ID: 12345678", "8 digits"],
    ["Israel National ID: 1234567890", "10 digits"],
    ["Israel National ID: 123456789_", "underscore after candidate"],
    ["_Israel: 123456789", "underscore before label"],
    ["Israel National ID: 123456789x", "letter after candidate"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Israel National ID: 123456789");
    expect(result.text).toBe("Israel National ID: [IL_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "123456789",
      ruleId: "il_id",
      entityType: "il_id",
      reasons: ["il_id.format", "il_id.context"],
    });
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor({ action: "mask", preserve: { last: 4 } });
    expect(masker.redact("Israel National ID: 123456789")).toBe(
      "Israel National ID: *****6789",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor({ action: "remove" });
    expect(remover.redact("Israel National ID: 123456789")).toBe(
      "Israel National ID: ",
    );
  });
});
