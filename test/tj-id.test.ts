import { describe, expect, test } from "bun:test";
import { tjIdDetector } from "../src/detectors/national-id/tj-id";

describe("Tajikistan National ID detector", () => {
  test.each([
    "National ID: 123456789",
    "Tajik National ID: 123456789",
    "Tajikistan National ID: 123456789",
    "Identity: 123456789",
    "National ID: 1234567890",
    "Tajik National ID: 1234567890",
    "Tajikistan National ID: 1234567890",
    "Identity: 1234567890",
    "National ID:123456789",
    "National ID# 123456789",
    "National ID#123456789",
    "national id: 123456789",
    "National ID:\t123456789",
    "123456789 (National ID)",
    "123456789 National ID",
    "123456789\t(National ID)",
    "National ID: 123456789.",
    "(National ID: 123456789)",
  ])("positive: %s", (input) => {
    const detections = tjIdDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "tj_id",
      entityType: "tj_id",
      reasons: ["tj_id.format", "tj_id.context"],
    });
    expect(input.slice(detections[0]!.start, detections[0]!.end)).toMatch(
      /\d{9,10}/,
    );
  });

  test.each([
    ["123456789", "no context"],
    ["Reference: 123456789", "non-approved label"],
    ["myNational ID: 123456789", "label not whole — my prefix"],
    ["National IDx: 123456789", "label not whole — x suffix"],
    ["National ID:\n123456789", "newline between label and candidate"],
    ["National ID:         123456789", "9 spaces exceeds 0-8"],
    [
      "123456789(National ID)",
      "0 spaces before paren — following requires 1-8",
    ],
    ["123456789 (National ID", "missing closing paren"],
    [
      "123456789x (National ID)",
      "letter after candidate before following label",
    ],
    ["National ID: 12345678", "8 digits — too few"],
    ["National ID: 12345678901", "11 digits — too many"],
    ["National ID: 123456789_", "underscore after candidate"],
    ["_National ID: 123456789", "underscore before label"],
    ["National ID: 123456789\u0301", "combining mark after candidate"],
  ])("negative: %s (%s)", (input) => {
    const detections = tjIdDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("10-digit ID is accepted", () => {
    const detections = tjIdDetector.detect("National ID: 1234567890");
    expect(detections).toHaveLength(1);
    expect(
      "National ID: 1234567890".slice(detections[0]!.start, detections[0]!.end),
    ).toBe("1234567890");
  });

  test("multiple detections in one string", () => {
    const text = "National ID: 123456789 and National ID: 987654321";
    const detections = tjIdDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]!.start, detections[0]!.end)).toBe(
      "123456789",
    );
    expect(text.slice(detections[1]!.start, detections[1]!.end)).toBe(
      "987654321",
    );
  });

  test("detector metadata", () => {
    expect(tjIdDetector.id).toBe("tj_id");
    expect(tjIdDetector.entityType).toBe("tj_id");
    expect(tjIdDetector.replacement).toBe("[TJ_ID]");
    expect(tjIdDetector.stream).toEqual({
      maxMatchLength: 10,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
