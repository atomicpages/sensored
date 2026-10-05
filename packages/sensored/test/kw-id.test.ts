import { describe, expect, test } from "bun:test";
import { kwIdDetector } from "../src/detectors/national-id/kw-id";
import { processText } from "../src/engine";
import type { ActiveRule, RuleSetting } from "../src/types";

function makeRedactor(setting: RuleSetting) {
  const rules: ActiveRule[] = [{ detector: kwIdDetector, setting }];
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

describe("Kuwait Civil ID complete-string processing", () => {
  test.each([
    ["Kuwait Civil ID: 281011500123", "Kuwait Civil ID: [KW_ID]"],
    ["Civil ID: 281011500123", "Civil ID: [KW_ID]"],
    ["National ID: 281011500123", "National ID: [KW_ID]"],
    ["Kuwait National ID: 281011500123", "Kuwait National ID: [KW_ID]"],
    ["Kuwait Civil ID:281011500123", "Kuwait Civil ID:[KW_ID]"],
    ["Kuwait Civil ID# 281011500123", "Kuwait Civil ID# [KW_ID]"],
    ["281011500123 (Kuwait)", "[KW_ID] (Kuwait)"],
    ["281011500123 (Civil ID)", "[KW_ID] (Civil ID)"],
    ["kuwait civil id: 281011500123", "kuwait civil id: [KW_ID]"],
    ["KUWAIT CIVIL ID: 281011500123", "KUWAIT CIVIL ID: [KW_ID]"],
    ["Kuwait Civil ID: 281011500123.", "Kuwait Civil ID: [KW_ID]."],
    ["(Kuwait Civil ID: 281011500123)", "(Kuwait Civil ID: [KW_ID])"],
    [
      "Kuwait Civil ID: 281011500123 and Kuwait Civil ID: 291012500456",
      "Kuwait Civil ID: [KW_ID] and Kuwait Civil ID: [KW_ID]",
    ],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: 281011500123", "non-approved label"],
    ["281011500123", "no label"],
    ["myKuwait: 281011500123", "label not whole — my prefix"],
    ["Kuwaitx: 281011500123", "label not whole — x suffix"],
    ["Kuwait Civil ID: 28101150012", "11 digits"],
    ["Kuwait Civil ID: 2810115001234", "13 digits"],
    ["Kuwait Civil ID: 280001500123", "month 00"],
    ["Kuwait Civil ID: 281301500123", "month 13"],
    ["Kuwait Civil ID: 281200500123", "day 00"],
    ["Kuwait Civil ID: 281232500123", "day 32"],
    ["Kuwait Civil ID: 281011500123_", "underscore after candidate"],
    ["_Kuwait: 281011500123", "underscore before label"],
    ["Kuwait Civil ID: 281011500123x", "letter after candidate"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Kuwait Civil ID: 281011500123");
    expect(result.text).toBe("Kuwait Civil ID: [KW_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "281011500123",
      ruleId: "kw_id",
      entityType: "kw_id",
      reasons: ["kw_id.structure", "kw_id.context"],
    });
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor({ action: "mask", preserve: { last: 4 } });
    expect(masker.redact("Kuwait Civil ID: 281011500123")).toBe(
      "Kuwait Civil ID: ********0123",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor({ action: "remove" });
    expect(remover.redact("Kuwait Civil ID: 281011500123")).toBe(
      "Kuwait Civil ID: ",
    );
  });
});
