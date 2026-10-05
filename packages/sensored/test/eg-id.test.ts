import { describe, expect, test } from "bun:test";
import { emailDetector } from "../src/detectors/contact/email";
import { egIdDetector } from "../src/detectors/national-id/eg-id";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: egIdDetector, setting: { action: "redact" } },
]);

describe("Egypt National ID complete-string processing", () => {
  test.each([
    ["National ID: 29001011234567", "National ID: [EG_ID]"],
    ["Identity: 29001011234567", "Identity: [EG_ID]"],
    ["Egypt: 29001011234567", "Egypt: [EG_ID]"],
    ["Egyptian: 29001011234567", "Egyptian: [EG_ID]"],
    ["National ID:29001011234567", "National ID:[EG_ID]"],
    ["National ID# 29001011234567", "National ID# [EG_ID]"],
    ["National ID#29001011234567", "National ID#[EG_ID]"],
    ["29001011234567 (National ID)", "[EG_ID] (National ID)"],
    ["29001011234567 National ID", "[EG_ID] National ID"],
    ["29001011234567 (Egypt)", "[EG_ID] (Egypt)"],
    ["29001011234567 (Identity)", "[EG_ID] (Identity)"],
    ["national id: 29001011234567", "national id: [EG_ID]"],
    ["EGYPT: 29001011234567", "EGYPT: [EG_ID]"],
    ["National ID:        29001011234567", "National ID:        [EG_ID]"],
    ["National ID:\t29001011234567", "National ID:\t[EG_ID]"],
    ["National ID: \t 29001011234567", "National ID: \t [EG_ID]"],
    ["29001011234567\t(National ID)", "[EG_ID]\t(National ID)"],
    ["29001011234567        (Egypt)", "[EG_ID]        (Egypt)"],
    [
      "National ID: 29001011234567 and National ID: 18506051234567",
      "National ID: [EG_ID] and National ID: [EG_ID]",
    ],
    ["National ID: 29001011234567.", "National ID: [EG_ID]."],
    ["(National ID: 29001011234567)", "(National ID: [EG_ID])"],
    ["National ID: 19001011234567", "National ID: [EG_ID]"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["National ID: 39001011234567", "starts with 3 — invalid"],
    ["National ID: 29001001234567", "invalid month 00"],
    ["National ID: 29001131234567", "invalid month 13"],
    ["National ID: 29001010034567", "invalid day 00"],
    ["National ID: 29001013234567", "invalid day 32"],
    ["Reference: 29001011234567", "non-approved label"],
    ["29001011234567", "no label"],
    ["myNational ID: 29001011234567", "label not whole — my prefix"],
    ["National IDx: 29001011234567", "label not whole — x suffix"],
    ["National ID:\n29001011234567", "newline between label and candidate"],
    ["National ID:         29001011234567", "9 spaces exceeds 0-8"],
    [
      "29001011234567(National ID)",
      "0 spaces before paren — following requires 1-8",
    ],
    ["29001011234567 (National ID", "missing closing paren"],
    [
      "29001011234567x (National ID)",
      "letter after candidate before following label",
    ],
    ["National ID: 290010112345670", "digit after candidate"],
    ["National ID: 029001011234567", "digit before candidate"],
    ["National ID: 29001011234567_", "underscore after candidate"],
    ["_National ID: 29001011234567", "underscore before label"],
    ["National ID: 29001011234567\u0301", "combining mark after candidate"],
    ["National ID: 2900101123456", "13 digits — too few"],
    ["National ID: 290010112345678", "15 digits — too many"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("National ID: 29001011234567");
    expect(result.text).toBe("National ID: [EG_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "29001011234567",
      ruleId: "eg_id",
      entityType: "eg_id",
      reasons: ["eg_id.structure", "eg_id.context"],
    });
    expect(result.groups[0]?.start).toBe(13);
    expect(result.groups[0]?.end).toBe(27);
  });

  test("inspection for following context", () => {
    const result = redactor.inspect("29001011234567 (National ID)");
    expect(result.text).toBe("[EG_ID] (National ID)");
    expect(result.groups[0]?.matches[0]?.value).toBe("29001011234567");
    expect(result.groups[0]?.start).toBe(0);
    expect(result.groups[0]?.end).toBe(14);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor([
      {
        detector: egIdDetector,
        setting: { action: "mask", preserve: { last: 4 } },
      },
    ]);
    expect(masker.redact("National ID: 29001011234567")).toBe(
      "National ID: **********4567",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor([
      { detector: egIdDetector, setting: { action: "remove" } },
    ]);
    expect(remover.redact("National ID: 29001011234567")).toBe("National ID: ");
    expect(remover.redact("29001011234567 (National ID)")).toBe(
      " (National ID)",
    );
  });

  test("coexists with email detector", () => {
    const both = makeRedactor([
      { detector: emailDetector, setting: { action: "redact" } },
      { detector: egIdDetector, setting: { action: "redact" } },
    ]);
    expect(
      both.redact("Email: alice@example.com National ID: 29001011234567"),
    ).toBe("Email: [EMAIL] National ID: [EG_ID]");
  });

  test("policy is a frozen snapshot", () => {
    const setting = { action: "redact" as const };
    const instance = makeRedactor([{ detector: egIdDetector, setting }]);
    expect(Object.isFrozen(instance.policy.eg_id)).toBe(true);
    expect(instance.policy.eg_id).not.toBe(setting);
  });
});
