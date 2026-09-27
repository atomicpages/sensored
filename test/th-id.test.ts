import { describe, expect, test } from "bun:test";
import { thIdDetector } from "../src/detectors/national-id/th-id";

const MATCH = "1234567890121";

describe("Thailand National ID detector — positive cases", () => {
  test.each([
    "Thailand National ID: 1234567890121",
    "Thai National ID: 1234567890121",
    "National ID: 1234567890121",
    "Thailand: 1234567890121",
    "Thai: 1234567890121",
    "National ID:1234567890121",
    "National ID# 1234567890121",
    "National ID#1234567890121",
    "national id: 1234567890121",
    "THAILAND: 1234567890121",
    "National ID:\t1234567890121",
    "National ID: \t 1234567890121",
    "1234567890121 (National ID)",
    "1234567890121 National ID",
    "1234567890121 (Thailand)",
    "National ID: 1234567890121.",
    "(National ID: 1234567890121)",
  ])("%s", (input) => {
    const detections = thIdDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "th_id",
      entityType: "th_id",
      reasons: ["th_id.checksum", "th_id.context"],
    });
    expect(detections[0]?.start).toBe(input.indexOf(MATCH));
    expect(detections[0]?.end).toBe(input.indexOf(MATCH) + MATCH.length);
  });

  test("multiple valid Thai IDs in one text", () => {
    const text = "National ID: 1234567890121 and National ID: 1234567890121";
    const detections = thIdDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(13);
    expect(detections[1]?.start).toBe(44);
  });
});

describe("Thailand National ID detector — checksum validation", () => {
  test("valid checksum is accepted", () => {
    const text = "National ID: 1234567890121";
    const detections = thIdDetector.detect(text);
    expect(detections).toHaveLength(1);
  });

  test("invalid checksum is rejected", () => {
    const text = "National ID: 1234567890122";
    const detections = thIdDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("all zeros is rejected by checksum", () => {
    const text = "National ID: 0000000000000";
    const detections = thIdDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("all same digits is rejected by checksum", () => {
    const text = "National ID: 1111111111111";
    const detections = thIdDetector.detect(text);
    expect(detections).toHaveLength(0);
  });
});

describe("Thailand National ID detector — negative cases", () => {
  test.each([
    ["1234567890121", "no context"],
    ["Reference: 1234567890121", "non-approved label"],
    ["myNational ID: 1234567890121", "label not whole — my prefix"],
    ["National IDX: 1234567890121", "label not whole — x suffix"],
    ["National ID:\n1234567890121", "newline between label and candidate"],
    ["National ID:         1234567890121", "9 spaces exceeds 0-8"],
    ["1234567890121(National ID)", "0 spaces before paren"],
    ["1234567890121 (National ID", "missing closing paren"],
    ["1234567890121x (National ID)", "letter after candidate before label"],
    ["National ID: 12345678901210", "14 digits — adjacency blocks"],
    ["National ID: 123456789012_", "underscore after candidate"],
    ["_National ID: 1234567890121", "underscore before label"],
    ["National ID: 123456789012", "12 digits — too short"],
    ["National ID: 12345678901214", "14 digits — too long, adjacency blocks"],
  ])("%s (%s)", (input) => {
    const detections = thIdDetector.detect(input);
    expect(detections).toHaveLength(0);
  });
});

describe("Thailand National ID detector — boundary cases", () => {
  test("trailing period is preserved", () => {
    const text = "National ID: 1234567890121.";
    const detections = thIdDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.end).toBe(text.indexOf(MATCH) + MATCH.length);
  });

  test("candidate at start with following context", () => {
    const text = "1234567890121 (National ID)";
    const detections = thIdDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(0);
  });

  test("Thai language context label", () => {
    const text = "บัตร: 1234567890121";
    const detections = thIdDetector.detect(text);
    expect(detections).toHaveLength(1);
  });

  test("Thai language ประชาชน context label", () => {
    const text = "ประชาชน: 1234567890121";
    const detections = thIdDetector.detect(text);
    expect(detections).toHaveLength(1);
  });
});

describe("Thailand National ID detector — adversarial cases", () => {
  test("emoji before candidate does not shift alignment", () => {
    const text = "\ud83d\ude00 National ID: 1234567890121";
    const detections = thIdDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(text.indexOf(MATCH));
  });

  test("Unicode number after candidate", () => {
    const text = "National ID: 1234567890121\ud835\udfd9";
    const detections = thIdDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("combining mark after candidate", () => {
    const text = "National ID: 1234567890121\u0301";
    const detections = thIdDetector.detect(text);
    expect(detections).toHaveLength(0);
  });
});
