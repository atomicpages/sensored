import { describe, expect, test } from "bun:test";
import { lbIdDetector } from "../src/detectors/national-id/lb-id";
import { processText } from "../src/engine";
import type { ActiveRule, RuleSetting } from "../src/types";

function makeRedactor(setting: RuleSetting) {
  const rules: ActiveRule[] = [{ detector: lbIdDetector, setting }];
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

describe("Lebanon National ID complete-string processing", () => {
  test.each([
    ["Lebanon National ID: 1234567", "Lebanon National ID: [LB_ID]"],
    ["Lebanese National ID: 12345678", "Lebanese National ID: [LB_ID]"],
    ["Beirut National ID: 1234567", "Beirut National ID: [LB_ID]"],
    ["National ID: 12345678", "National ID: [LB_ID]"],
    ["Lebanon National ID:1234567", "Lebanon National ID:[LB_ID]"],
    ["Lebanon National ID# 1234567", "Lebanon National ID# [LB_ID]"],
    ["1234567 (Lebanon)", "[LB_ID] (Lebanon)"],
    ["12345678 (National ID)", "[LB_ID] (National ID)"],
    ["lebanon national id: 1234567", "lebanon national id: [LB_ID]"],
    ["LEBANON NATIONAL ID: 12345678", "LEBANON NATIONAL ID: [LB_ID]"],
    ["Lebanon National ID: 1234567.", "Lebanon National ID: [LB_ID]."],
    ["(Lebanon National ID: 1234567)", "(Lebanon National ID: [LB_ID])"],
    [
      "Lebanon National ID: 1234567 and Lebanon National ID: 87654321",
      "Lebanon National ID: [LB_ID] and Lebanon National ID: [LB_ID]",
    ],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: 1234567", "non-approved label"],
    ["1234567", "no label"],
    ["myLebanon: 1234567", "label not whole — my prefix"],
    ["Lebanonx: 1234567", "label not whole — x suffix"],
    ["Lebanon National ID: 123456", "6 digits"],
    ["Lebanon National ID: 123456789", "9 digits"],
    ["Lebanon National ID: 1234567_", "underscore after candidate"],
    ["_Lebanon: 1234567", "underscore before label"],
    ["Lebanon National ID: 1234567x", "letter after candidate"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Lebanon National ID: 1234567");
    expect(result.text).toBe("Lebanon National ID: [LB_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "1234567",
      ruleId: "lb_id",
      entityType: "lb_id",
      reasons: ["lb_id.format", "lb_id.context"],
    });
  });

  test("inspection for 8-digit format", () => {
    const result = redactor.inspect("Lebanon National ID: 12345678");
    expect(result.text).toBe("Lebanon National ID: [LB_ID]");
    expect(result.groups[0]?.matches[0]?.value).toBe("12345678");
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor({ action: "mask", preserve: { last: 4 } });
    expect(masker.redact("Lebanon National ID: 1234567")).toBe(
      "Lebanon National ID: ***4567",
    );
    expect(masker.redact("Lebanon National ID: 12345678")).toBe(
      "Lebanon National ID: ****5678",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor({ action: "remove" });
    expect(remover.redact("Lebanon National ID: 1234567")).toBe(
      "Lebanon National ID: ",
    );
  });
});
