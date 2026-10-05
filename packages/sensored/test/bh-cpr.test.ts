import { describe, expect, test } from "bun:test";
import { bhCprDetector } from "../src/detectors/national-id/bh-cpr";
import { processText } from "../src/engine";
import type { ActiveRule, RuleSetting } from "../src/types";

function makeRedactor(setting: RuleSetting) {
  const rules: ActiveRule[] = [{ detector: bhCprDetector, setting }];
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

describe("Bahrain CPR complete-string processing", () => {
  test.each([
    ["Bahrain CPR: 881011501", "Bahrain CPR: [BH_CPR]"],
    ["Central Population: 881011501", "Central Population: [BH_CPR]"],
    ["National ID: 881011501", "National ID: [BH_CPR]"],
    ["CPR: 881011501", "CPR: [BH_CPR]"],
    ["Bahrain National ID: 881011501", "Bahrain National ID: [BH_CPR]"],
    ["Bahrain CPR:881011501", "Bahrain CPR:[BH_CPR]"],
    ["Bahrain CPR# 881011501", "Bahrain CPR# [BH_CPR]"],
    ["881011501 (Bahrain)", "[BH_CPR] (Bahrain)"],
    ["881011501 (CPR)", "[BH_CPR] (CPR)"],
    ["bahrain cpr: 881011501", "bahrain cpr: [BH_CPR]"],
    ["BAHRAIN CPR: 881011501", "BAHRAIN CPR: [BH_CPR]"],
    ["Bahrain CPR: 881011501.", "Bahrain CPR: [BH_CPR]."],
    ["(Bahrain CPR: 881011501)", "(Bahrain CPR: [BH_CPR])"],
    [
      "Bahrain CPR: 881011501 and Bahrain CPR: 891012502",
      "Bahrain CPR: [BH_CPR] and Bahrain CPR: [BH_CPR]",
    ],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: 881011501", "non-approved label"],
    ["881011501", "no label"],
    ["myBahrain: 881011501", "label not whole — my prefix"],
    ["Bahrainx: 881011501", "label not whole — x suffix"],
    ["Bahrain CPR: 88101150", "8 digits"],
    ["Bahrain CPR: 8810115012", "10 digits"],
    ["Bahrain CPR: 880011501", "month 00"],
    ["Bahrain CPR: 881311501", "month 13"],
    ["Bahrain CPR: 881000501", "day 00"],
    ["Bahrain CPR: 881032501", "day 32"],
    ["Bahrain CPR: 881011501_", "underscore after candidate"],
    ["_Bahrain: 881011501", "underscore before label"],
    ["Bahrain CPR: 881011501x", "letter after candidate"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Bahrain CPR: 881011501");
    expect(result.text).toBe("Bahrain CPR: [BH_CPR]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "881011501",
      ruleId: "bh_cpr",
      entityType: "bh_cpr",
      reasons: ["bh_cpr.structure", "bh_cpr.context"],
    });
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor({ action: "mask", preserve: { last: 4 } });
    expect(masker.redact("Bahrain CPR: 881011501")).toBe(
      "Bahrain CPR: *****1501",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor({ action: "remove" });
    expect(remover.redact("Bahrain CPR: 881011501")).toBe("Bahrain CPR: ");
  });
});
