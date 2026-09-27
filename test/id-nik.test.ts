import { describe, expect, test } from "bun:test";
import { idNikDetector } from "../src/detectors/national-id/id-nik";

const MATCH = "1234567890123456";

describe("Indonesia NIK detector — positive cases", () => {
  test.each([
    "Indonesia NIK: 1234567890123456",
    "Indonesian NIK: 1234567890123456",
    "NIK: 1234567890123456",
    "Nomor Induk: 1234567890123456",
    "KTP: 1234567890123456",
    "National ID: 1234567890123456",
    "NIK:1234567890123456",
    "NIK# 1234567890123456",
    "NIK#1234567890123456",
    "nik: 1234567890123456",
    "INDONESIA: 1234567890123456",
    "NIK:\t1234567890123456",
    "NIK: \t 1234567890123456",
    "1234567890123456 (NIK)",
    "1234567890123456 NIK",
    "1234567890123456 (Indonesia)",
    "NIK: 1234567890123456.",
    "(NIK: 1234567890123456)",
  ])("%s", (input) => {
    const detections = idNikDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "id_nik",
      entityType: "id_nik",
      reasons: ["id_nik.format", "id_nik.context"],
    });
    expect(detections[0]?.start).toBe(input.indexOf(MATCH));
    expect(detections[0]?.end).toBe(input.indexOf(MATCH) + MATCH.length);
  });

  test("multiple NIKs in one text", () => {
    const text = "NIK: 1234567890123456 and NIK: 9876543210987654";
    const detections = idNikDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(5);
    expect(detections[0]?.end).toBe(21);
    expect(detections[1]?.start).toBe(31);
    expect(detections[1]?.end).toBe(47);
  });
});

describe("Indonesia NIK detector — negative cases", () => {
  test.each([
    ["1234567890123456", "no context"],
    ["Reference: 1234567890123456", "non-approved label"],
    ["myNIK: 1234567890123456", "label not whole — my prefix"],
    ["NIKx: 1234567890123456", "label not whole — x suffix"],
    ["NIK:\n1234567890123456", "newline between label and candidate"],
    ["NIK:         1234567890123456", "9 spaces exceeds 0-8"],
    ["1234567890123456(NIK)", "0 spaces before paren — following requires 1-8"],
    ["1234567890123456 (NIK", "missing closing paren"],
    [
      "1234567890123456x (NIK)",
      "letter after candidate before following label",
    ],
    ["NIK: 12345678901234560", "17 digits — adjacency prevents partial match"],
    ["NIK: 1234567890123456_", "underscore after candidate"],
    ["_NIK: 1234567890123456", "underscore before label"],
    ["NIK: 123456789012345", "15 digits — too short"],
    ["NIK: 12345678901234567", "17 digits — too long, adjacency blocks"],
  ])("%s (%s)", (input) => {
    const detections = idNikDetector.detect(input);
    expect(detections).toHaveLength(0);
  });
});

describe("Indonesia NIK detector — boundary cases", () => {
  test("trailing period is preserved (not part of match)", () => {
    const text = "NIK: 1234567890123456.";
    const detections = idNikDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.end).toBe(text.indexOf(MATCH) + MATCH.length);
  });

  test("trailing text is preserved", () => {
    const text = "NIK: 1234567890123456 extra";
    const detections = idNikDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.end).toBe(text.indexOf(MATCH) + MATCH.length);
  });

  test("candidate at start of string with following context", () => {
    const text = "1234567890123456 (NIK)";
    const detections = idNikDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(0);
  });
});

describe("Indonesia NIK detector — adversarial cases", () => {
  test("emoji before candidate does not shift alignment", () => {
    const text = "\ud83d\ude00 NIK: 1234567890123456";
    const detections = idNikDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(text.indexOf(MATCH));
  });

  test("Unicode number before label", () => {
    const text = "\ud835\udfd9NIK: 1234567890123456";
    const detections = idNikDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("Unicode number after candidate", () => {
    const text = "NIK: 1234567890123456\ud835\udfd9";
    const detections = idNikDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("combining mark after candidate", () => {
    const text = "NIK: 1234567890123456\u0301";
    const detections = idNikDetector.detect(text);
    expect(detections).toHaveLength(0);
  });
});
