import { describe, expect, test } from "bun:test";
import { bgEgnDetector } from "../src/detectors/national-id/bg-egn";

describe("BG EGN detector", () => {
  test.each([
    "Bulgaria EGN: 9001011234",
    "Bulgarian EGN: 7523124567",
    "EGN: 9001011234",
    "Personal Number: 9001011234",
    "Единен: 9001011234",
    "EGN:9001011234",
    "EGN# 9001011234",
    "EGN#9001011234",
    "egn: 9001011234",
    "EGN:\t9001011234",
    "9001011234 (EGN)",
    "9001011234 EGN",
    "9001011234\t(EGN)",
    "EGN: 9001011234.",
    "(EGN: 9001011234)",
    "EGN: 9021011234",
    "EGN: 9041011234",
    "EGN: 9012311234",
  ])("positive: %s", (input) => {
    const detections = bgEgnDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "bg_egn",
      entityType: "bg_egn",
      reasons: ["bg_egn.structure", "bg_egn.context"],
    });
    expect(input.slice(detections[0]!.start, detections[0]!.end)).toMatch(
      /\d{10}/,
    );
  });

  test.each([
    ["Reference: 9001011234", "non-approved label"],
    ["9001011234", "no context"],
    ["myEGN: 9001011234", "label not whole — my prefix"],
    ["EGNx: 9001011234", "label not whole — x suffix"],
    ["EGN:\n9001011234", "newline between label and candidate"],
    ["EGN:         9001011234", "9 spaces exceeds 0-8"],
    ["9001011234(EGN)", "0 spaces before paren — following requires 1-8"],
    ["9001011234 (EGN", "missing closing paren"],
    ["9001011234x (EGN)", "letter after candidate before following label"],
    ["EGN: 90010112345", "digit after candidate"],
    ["EGN: 09001011234", "digit before candidate"],
    ["EGN: 9001011234_", "underscore after candidate"],
    ["_EGN: 9001011234", "underscore before label"],
    ["EGN: 9001011234\u0301", "combining mark after candidate"],
    ["EGN: 9000011234", "month 00 invalid"],
    ["EGN: 9013011234", "month 13 invalid"],
    ["EGN: 9033011234", "month 33 invalid (between 32 and 41)"],
    ["EGN: 9053011234", "month 53 invalid (above 52)"],
    ["EGN: 9001001234", "day 00 invalid"],
    ["EGN: 9001321234", "day 32 invalid"],
    ["EGN: 900101123", "9 digits"],
    ["EGN: 90010112345", "11 digits"],
  ])("negative: %s (%s)", (input) => {
    const detections = bgEgnDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "EGN: 9001011234 and EGN: 7523124567";
    const detections = bgEgnDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]!.start, detections[0]!.end)).toBe(
      "9001011234",
    );
    expect(text.slice(detections[1]!.start, detections[1]!.end)).toBe(
      "7523124567",
    );
  });

  test("detector metadata", () => {
    expect(bgEgnDetector.id).toBe("bg_egn");
    expect(bgEgnDetector.entityType).toBe("bg_egn");
    expect(bgEgnDetector.replacement).toBe("[BG_EGN]");
    expect(bgEgnDetector.stream).toEqual({
      maxMatchLength: 10,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
