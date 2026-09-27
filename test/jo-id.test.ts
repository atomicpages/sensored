import { describe, expect, test } from "bun:test";
import { joIdDetector } from "../src/detectors/national-id/jo-id";
import { processText } from "../src/engine";
import type { ActiveRule, RuleSetting } from "../src/types";

function makeRedactor(setting: RuleSetting) {
  const rules: ActiveRule[] = [{ detector: joIdDetector, setting }];
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

describe("Jordan National ID complete-string processing", () => {
  test.each([
    ["Jordan National ID: 1234567890", "Jordan National ID: [JO_ID]"],
    ["Amman National ID: 2345678901", "Amman National ID: [JO_ID]"],
    ["National ID: 1234567890", "National ID: [JO_ID]"],
    ["Jordanian: 1234567890", "Jordanian: [JO_ID]"],
    ["Jordan National ID:1234567890", "Jordan National ID:[JO_ID]"],
    ["Jordan National ID# 1234567890", "Jordan National ID# [JO_ID]"],
    ["1234567890 (Jordan)", "[JO_ID] (Jordan)"],
    ["1234567890 (National ID)", "[JO_ID] (National ID)"],
    ["jordan national id: 1234567890", "jordan national id: [JO_ID]"],
    ["JORDAN NATIONAL ID: 1234567890", "JORDAN NATIONAL ID: [JO_ID]"],
    ["Jordan National ID: 1234567890.", "Jordan National ID: [JO_ID]."],
    ["(Jordan National ID: 1234567890)", "(Jordan National ID: [JO_ID])"],
    [
      "Jordan National ID: 1234567890 and Jordan National ID: 2345678901",
      "Jordan National ID: [JO_ID] and Jordan National ID: [JO_ID]",
    ],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: 1234567890", "non-approved label"],
    ["1234567890", "no label"],
    ["myJordan: 1234567890", "label not whole — my prefix"],
    ["Jordanx: 1234567890", "label not whole — x suffix"],
    ["Jordan National ID: 123456789", "9 digits"],
    ["Jordan National ID: 12345678901", "11 digits"],
    ["Jordan National ID: 1234567890_", "underscore after candidate"],
    ["_Jordan: 1234567890", "underscore before label"],
    ["Jordan National ID: 1234567890x", "letter after candidate"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Jordan National ID: 1234567890");
    expect(result.text).toBe("Jordan National ID: [JO_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "1234567890",
      ruleId: "jo_id",
      entityType: "jo_id",
      reasons: ["jo_id.format", "jo_id.context"],
    });
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor({ action: "mask", preserve: { last: 4 } });
    expect(masker.redact("Jordan National ID: 1234567890")).toBe(
      "Jordan National ID: ******7890",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor({ action: "remove" });
    expect(remover.redact("Jordan National ID: 1234567890")).toBe(
      "Jordan National ID: ",
    );
  });
});
