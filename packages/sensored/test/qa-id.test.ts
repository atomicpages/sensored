import { describe, expect, test } from "bun:test";
import { qaIdDetector } from "../src/detectors/national-id/qa-id";
import { processText } from "../src/engine";
import type { ActiveRule, RuleSetting } from "../src/types";

function makeRedactor(setting: RuleSetting) {
  const rules: ActiveRule[] = [{ detector: qaIdDetector, setting }];
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

describe("Qatar QID complete-string processing", () => {
  test.each([
    ["Qatar QID: 12345678901", "Qatar QID: [QA_ID]"],
    ["Doha National ID: 23456789012", "Doha National ID: [QA_ID]"],
    ["Resident Permit: 12345678901", "Resident Permit: [QA_ID]"],
    ["QID: 12345678901", "QID: [QA_ID]"],
    ["National ID: 12345678901", "National ID: [QA_ID]"],
    ["Qatar QID:12345678901", "Qatar QID:[QA_ID]"],
    ["Qatar QID# 12345678901", "Qatar QID# [QA_ID]"],
    ["12345678901 (Qatar)", "[QA_ID] (Qatar)"],
    ["12345678901 (National ID)", "[QA_ID] (National ID)"],
    ["qatar qid: 12345678901", "qatar qid: [QA_ID]"],
    ["QATAR QID: 12345678901", "QATAR QID: [QA_ID]"],
    ["Qatar QID: 12345678901.", "Qatar QID: [QA_ID]."],
    ["(Qatar QID: 12345678901)", "(Qatar QID: [QA_ID])"],
    [
      "Qatar QID: 12345678901 and Qatar QID: 23456789012",
      "Qatar QID: [QA_ID] and Qatar QID: [QA_ID]",
    ],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: 12345678901", "non-approved label"],
    ["12345678901", "no label"],
    ["myQatar: 12345678901", "label not whole — my prefix"],
    ["Qatarx: 12345678901", "label not whole — x suffix"],
    ["Qatar QID: 1234567890", "10 digits"],
    ["Qatar QID: 123456789012", "12 digits"],
    ["Qatar QID: 12345678901_", "underscore after candidate"],
    ["_Qatar: 12345678901", "underscore before label"],
    ["Qatar QID: 12345678901x", "letter after candidate"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Qatar QID: 12345678901");
    expect(result.text).toBe("Qatar QID: [QA_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "12345678901",
      ruleId: "qa_id",
      entityType: "qa_id",
      reasons: ["qa_id.format", "qa_id.context"],
    });
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor({ action: "mask", preserve: { last: 4 } });
    expect(masker.redact("Qatar QID: 12345678901")).toBe(
      "Qatar QID: *******8901",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor({ action: "remove" });
    expect(remover.redact("Qatar QID: 12345678901")).toBe("Qatar QID: ");
  });
});
