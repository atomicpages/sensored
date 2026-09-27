import { describe, expect, test } from "bun:test";
import { huIdDetector } from "../src/detectors/national-id/hu-id";

describe("HU Personal ID detector", () => {
  test.each([
    "Hungarian Personal ID: 123456AB",
    "Magyar: 123456AB",
    "Személyi: 123456AB",
    "Igazolvány: 123456AB",
    "Personal ID: 123456AB",
    "Hungarian:123456AB",
    "Hungarian# 123456AB",
    "Hungarian#123456AB",
    "hungarian: 123456AB",
    "HUNGARIAN: 123456AB",
    "Hungarian:\t123456AB",
    "123456AB (Hungarian)",
    "123456AB Hungarian",
    "123456AB\t(Hungarian)",
    "Hungarian: 123456AB.",
    "(Hungarian: 123456AB)",
  ])("positive: %s", (input) => {
    const detections = huIdDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "hu_id",
      entityType: "hu_id",
      reasons: ["hu_id.format", "hu_id.context"],
    });
    expect(input.slice(detections[0]!.start, detections[0]!.end)).toMatch(
      /\d{6}[A-Z]{2}/,
    );
  });

  test.each([
    ["Reference: 123456AB", "non-approved label"],
    ["123456AB", "no context"],
    ["myHungarian: 123456AB", "label not whole — my prefix"],
    ["Hungarianx: 123456AB", "label not whole — x suffix"],
    ["Hungarian:\n123456AB", "newline between label and candidate"],
    ["Hungarian:         123456AB", "9 spaces exceeds 0-8"],
    ["123456AB(Hungarian)", "0 spaces before paren — following requires 1-8"],
    ["123456AB (Hungarian", "missing closing paren"],
    ["123456ABx (Hungarian)", "letter after candidate before following label"],
    ["Hungarian: 123456ABC", "letter after candidate"],
    ["Hungarian: 0123456AB", "digit before candidate"],
    ["Hungarian: 123456AB_", "underscore after candidate"],
    ["_Hungarian: 123456AB", "underscore before label"],
    ["Hungarian: 123456AB\u0301", "combining mark after candidate"],
    ["Hungarian: 12345A", "5 digits"],
    ["Hungarian: 1234567A", "7 digits"],
    ["Hungarian: 123456A", "only 1 letter"],
    ["Hungarian: 123456ABC", "3 letters"],
    ["Hungarian: 123456ab", "lowercase letters"],
  ])("negative: %s (%s)", (input) => {
    const detections = huIdDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Hungarian: 123456AB and Hungarian: 789012CD";
    const detections = huIdDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]!.start, detections[0]!.end)).toBe(
      "123456AB",
    );
    expect(text.slice(detections[1]!.start, detections[1]!.end)).toBe(
      "789012CD",
    );
  });

  test("detector metadata", () => {
    expect(huIdDetector.id).toBe("hu_id");
    expect(huIdDetector.entityType).toBe("hu_id");
    expect(huIdDetector.replacement).toBe("[HU_ID]");
    expect(huIdDetector.stream).toEqual({
      maxMatchLength: 8,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
