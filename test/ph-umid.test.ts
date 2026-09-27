import { describe, expect, test } from "bun:test";
import { phUmidDetector } from "../src/detectors/national-id/ph-umid";

const MATCH = "1234-5678901-2";

describe("Philippines UMID detector — positive cases", () => {
  test.each([
    "Philippines UMID: 1234-5678901-2",
    "Filipino UMID: 1234-5678901-2",
    "UMID: 1234-5678901-2",
    "Unified: 1234-5678901-2",
    "Multipurpose: 1234-5678901-2",
    "National ID: 1234-5678901-2",
    "UMID:1234-5678901-2",
    "UMID# 1234-5678901-2",
    "umid: 1234-5678901-2",
    "UMID:\t1234-5678901-2",
    "UMID: \t 1234-5678901-2",
    "1234-5678901-2 (UMID)",
    "1234-5678901-2 UMID",
    "1234-5678901-2 (Philippines)",
    "UMID: 1234-5678901-2.",
    "(UMID: 1234-5678901-2)",
    "UMID: 1234 5678901 2",
  ])("%s", (input) => {
    const detections = phUmidDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "ph_umid",
      entityType: "ph_umid",
      reasons: ["ph_umid.format", "ph_umid.context"],
    });
    const match = input.includes(MATCH) ? MATCH : "1234 5678901 2";
    expect(detections[0]?.start).toBe(input.indexOf(match));
    expect(detections[0]?.end).toBe(input.indexOf(match) + match.length);
  });

  test("multiple UMIDs in one text", () => {
    const text = "UMID: 1234-5678901-2 and UMID: 5678-9012345-6";
    const detections = phUmidDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(6);
    expect(detections[1]?.start).toBe(31);
  });
});

describe("Philippines UMID detector — negative cases", () => {
  test.each([
    ["1234-5678901-2", "no context"],
    ["Reference: 1234-5678901-2", "non-approved label"],
    ["myUMID: 1234-5678901-2", "label not whole — my prefix"],
    ["UMIDx: 1234-5678901-2", "label not whole — x suffix"],
    ["UMID:\n1234-5678901-2", "newline between label and candidate"],
    ["UMID:         1234-5678901-2", "9 spaces exceeds 0-8"],
    ["1234-5678901-2(UMID)", "0 spaces before paren"],
    ["1234-5678901-2 (UMID", "missing closing paren"],
    ["1234-5678901-2x (UMID)", "letter after candidate before label"],
    ["UMID: 1234-5678901-2_", "underscore after candidate"],
    ["_UMID: 1234-5678901-2", "underscore before label"],
  ])("%s (%s)", (input) => {
    const detections = phUmidDetector.detect(input);
    expect(detections).toHaveLength(0);
  });
});

describe("Philippines UMID detector — boundary cases", () => {
  test("trailing period is preserved", () => {
    const text = "UMID: 1234-5678901-2.";
    const detections = phUmidDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.end).toBe(text.indexOf(MATCH) + MATCH.length);
  });

  test("space-separated format", () => {
    const text = "UMID: 1234 5678901 2";
    const detections = phUmidDetector.detect(text);
    expect(detections).toHaveLength(1);
  });

  test("compact format without separators", () => {
    const text = "UMID: 123456789012";
    const detections = phUmidDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(6);
    expect(detections[0]?.end).toBe(18);
  });

  test("candidate at start with following context", () => {
    const text = "1234-5678901-2 (UMID)";
    const detections = phUmidDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(0);
  });
});

describe("Philippines UMID detector — adversarial cases", () => {
  test("emoji before candidate does not shift alignment", () => {
    const text = "\ud83d\ude00 UMID: 1234-5678901-2";
    const detections = phUmidDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(text.indexOf(MATCH));
  });

  test("Unicode number after candidate", () => {
    const text = "UMID: 1234-5678901-2\ud835\udfd9";
    const detections = phUmidDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("combining mark after candidate", () => {
    const text = "UMID: 1234-5678901-2\u0301";
    const detections = phUmidDetector.detect(text);
    expect(detections).toHaveLength(0);
  });
});
