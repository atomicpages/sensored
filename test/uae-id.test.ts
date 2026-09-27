import { describe, expect, test } from "bun:test";
import { uaeIdDetector } from "../src/detectors/national-id/uae-id";
import { processText } from "../src/engine";
import type { ActiveRule, RuleSetting } from "../src/types";

function makeRedactor(setting: RuleSetting) {
  const rules: ActiveRule[] = [{ detector: uaeIdDetector, setting }];
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

describe("UAE Emirates ID complete-string processing", () => {
  test.each([
    ["Emirates ID: 784-1234-5678901-2", "Emirates ID: [UAE_ID]"],
    ["UAE National ID: 784123456789012", "UAE National ID: [UAE_ID]"],
    ["Dubai: 784 1234 5678901 2", "Dubai: [UAE_ID]"],
    ["Abu Dhabi: 784-1234-5678901-2", "Abu Dhabi: [UAE_ID]"],
    ["National ID: 784123456789012", "National ID: [UAE_ID]"],
    ["Emirates ID:784-1234-5678901-2", "Emirates ID:[UAE_ID]"],
    ["Emirates ID# 784-1234-5678901-2", "Emirates ID# [UAE_ID]"],
    ["784-1234-5678901-2 (UAE)", "[UAE_ID] (UAE)"],
    ["784123456789012 (Emirates ID)", "[UAE_ID] (Emirates ID)"],
    ["uae: 784-1234-5678901-2", "uae: [UAE_ID]"],
    ["EMIRATES ID: 784123456789012", "EMIRATES ID: [UAE_ID]"],
    ["Emirates ID: 784-1234-5678901-2.", "Emirates ID: [UAE_ID]."],
    ["(Emirates ID: 784-1234-5678901-2)", "(Emirates ID: [UAE_ID])"],
    [
      "Emirates ID: 784-1234-5678901-2 and Emirates ID: 784-9876-5432109-8",
      "Emirates ID: [UAE_ID] and Emirates ID: [UAE_ID]",
    ],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: 784-1234-5678901-2", "non-approved label"],
    ["784-1234-5678901-2", "no label"],
    ["myEmirates: 784-1234-5678901-2", "label not whole — my prefix"],
    ["Emiratesx: 784-1234-5678901-2", "label not whole — x suffix"],
    ["Emirates ID: 784-1234-5678901-23", "digit after candidate"],
    ["Emirates ID: 0784-1234-5678901-2", "digit before candidate"],
    ["Emirates ID: 784-1234-5678901-", "too few digits"],
    ["Emirates ID: 78412345678901", "14 digits compact"],
    ["Emirates ID: 7841234567890123", "16 digits compact"],
    ["Emirates ID: 784-1234-5678901-2_", "underscore after candidate"],
    ["_Emirates: 784-1234-5678901-2", "underscore before label"],
    ["Reference: 784123456789012", "non-approved label compact"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Emirates ID: 784-1234-5678901-2");
    expect(result.text).toBe("Emirates ID: [UAE_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "784-1234-5678901-2",
      ruleId: "uae_id",
      entityType: "uae_id",
      reasons: ["uae_id.format", "uae_id.context"],
    });
  });

  test("inspection for compact format", () => {
    const result = redactor.inspect("Emirates ID: 784123456789012");
    expect(result.text).toBe("Emirates ID: [UAE_ID]");
    expect(result.groups[0]?.matches[0]?.value).toBe("784123456789012");
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor({ action: "mask", preserve: { last: 4 } });
    expect(masker.redact("Emirates ID: 784123456789012")).toBe(
      "Emirates ID: ***********9012",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor({ action: "remove" });
    expect(remover.redact("Emirates ID: 784-1234-5678901-2")).toBe(
      "Emirates ID: ",
    );
  });
});
