import { describe, expect, test } from "bun:test";
import { omIdDetector } from "../src/detectors/national-id/om-id";
import { processText } from "../src/engine";
import type { ActiveRule, RuleSetting } from "../src/types";

function makeRedactor(setting: RuleSetting) {
  const rules: ActiveRule[] = [{ detector: omIdDetector, setting }];
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

describe("Oman Civil ID complete-string processing", () => {
  test.each([
    ["Oman Civil ID: 12345678", "Oman Civil ID: [OM_ID]"],
    ["Muscat National ID: 87654321", "Muscat National ID: [OM_ID]"],
    ["Civil ID: 12345678", "Civil ID: [OM_ID]"],
    ["National ID: 12345678", "National ID: [OM_ID]"],
    ["Oman National ID: 12345678", "Oman National ID: [OM_ID]"],
    ["Oman Civil ID:12345678", "Oman Civil ID:[OM_ID]"],
    ["Oman Civil ID# 12345678", "Oman Civil ID# [OM_ID]"],
    ["12345678 (Oman)", "[OM_ID] (Oman)"],
    ["12345678 (Civil ID)", "[OM_ID] (Civil ID)"],
    ["oman civil id: 12345678", "oman civil id: [OM_ID]"],
    ["OMAN CIVIL ID: 12345678", "OMAN CIVIL ID: [OM_ID]"],
    ["Oman Civil ID: 12345678.", "Oman Civil ID: [OM_ID]."],
    ["(Oman Civil ID: 12345678)", "(Oman Civil ID: [OM_ID])"],
    [
      "Oman Civil ID: 12345678 and Oman Civil ID: 87654321",
      "Oman Civil ID: [OM_ID] and Oman Civil ID: [OM_ID]",
    ],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: 12345678", "non-approved label"],
    ["12345678", "no label"],
    ["myOman: 12345678", "label not whole — my prefix"],
    ["Omanx: 12345678", "label not whole — x suffix"],
    ["Oman Civil ID: 1234567", "7 digits"],
    ["Oman Civil ID: 123456789", "9 digits"],
    ["Oman Civil ID: 12345678_", "underscore after candidate"],
    ["_Oman: 12345678", "underscore before label"],
    ["Oman Civil ID: 12345678x", "letter after candidate"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Oman Civil ID: 12345678");
    expect(result.text).toBe("Oman Civil ID: [OM_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "12345678",
      ruleId: "om_id",
      entityType: "om_id",
      reasons: ["om_id.format", "om_id.context"],
    });
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor({ action: "mask", preserve: { last: 4 } });
    expect(masker.redact("Oman Civil ID: 12345678")).toBe(
      "Oman Civil ID: ****5678",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor({ action: "remove" });
    expect(remover.redact("Oman Civil ID: 12345678")).toBe("Oman Civil ID: ");
  });
});
