import { describe, expect, test } from "bun:test";
import { vnCccdDetector } from "../src/detectors/national-id/vn-cccd";

const MATCH = "123456789012";

describe("Vietnam CCCD detector — positive cases", () => {
  test.each([
    "Vietnam CCCD: 123456789012",
    "Vietnamese CCCD: 123456789012",
    "CCCD: 123456789012",
    "Citizen Identity: 123456789012",
    "CMND: 123456789012",
    "National ID: 123456789012",
    "CCCD:123456789012",
    "CCCD# 123456789012",
    "CCCD#123456789012",
    "cccd: 123456789012",
    "VIETNAM: 123456789012",
    "CCCD:\t123456789012",
    "CCCD: \t 123456789012",
    "123456789012 (CCCD)",
    "123456789012 CCCD",
    "123456789012 (Vietnam)",
    "CCCD: 123456789012.",
    "(CCCD: 123456789012)",
  ])("%s", (input) => {
    const detections = vnCccdDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "vn_cccd",
      entityType: "vn_cccd",
      reasons: ["vn_cccd.format", "vn_cccd.context"],
    });
    expect(detections[0]?.start).toBe(input.indexOf(MATCH));
    expect(detections[0]?.end).toBe(input.indexOf(MATCH) + MATCH.length);
  });

  test("multiple CCCDs in one text", () => {
    const text = "CCCD: 123456789012 and CCCD: 987654321098";
    const detections = vnCccdDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(6);
    expect(detections[1]?.start).toBe(29);
  });
});

describe("Vietnam CCCD detector — negative cases", () => {
  test.each([
    ["123456789012", "no context"],
    ["Reference: 123456789012", "non-approved label"],
    ["myCCCD: 123456789012", "label not whole — my prefix"],
    ["CCCDx: 123456789012", "label not whole — x suffix"],
    ["CCCD:\n123456789012", "newline between label and candidate"],
    ["CCCD:         123456789012", "9 spaces exceeds 0-8"],
    ["123456789012(CCCD)", "0 spaces before paren"],
    ["123456789012 (CCCD", "missing closing paren"],
    ["123456789012x (CCCD)", "letter after candidate before label"],
    ["CCCD: 123456789012_", "underscore after candidate"],
    ["_CCCD: 123456789012", "underscore before label"],
    ["CCCD: 12345678901", "11 digits — too short"],
    ["CCCD: 1234567890123", "13 digits — too long, adjacency blocks"],
  ])("%s (%s)", (input) => {
    const detections = vnCccdDetector.detect(input);
    expect(detections).toHaveLength(0);
  });
});

describe("Vietnam CCCD detector — boundary cases", () => {
  test("trailing period is preserved", () => {
    const text = "CCCD: 123456789012.";
    const detections = vnCccdDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.end).toBe(text.indexOf(MATCH) + MATCH.length);
  });

  test("candidate at start with following context", () => {
    const text = "123456789012 (CCCD)";
    const detections = vnCccdDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(0);
  });
});

describe("Vietnam CCCD detector — adversarial cases", () => {
  test("emoji before candidate does not shift alignment", () => {
    const text = "\ud83d\ude00 CCCD: 123456789012";
    const detections = vnCccdDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(text.indexOf(MATCH));
  });

  test("Unicode number after candidate", () => {
    const text = "CCCD: 123456789012\ud835\udfd9";
    const detections = vnCccdDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("combining mark after candidate", () => {
    const text = "CCCD: 123456789012\u0301";
    const detections = vnCccdDetector.detect(text);
    expect(detections).toHaveLength(0);
  });
});
