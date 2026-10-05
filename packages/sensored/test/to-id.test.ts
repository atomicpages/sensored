import { describe, expect, test } from "bun:test";
import { toIdDetector } from "../src/detectors/national-id/to-id";

describe("Tonga National ID detector", () => {
  test.each([
    ["Tonga: ABCD1234", 7, 15],
    ["Tongan: ABCD1234", 8, 16],
    ["National ID: ABCD1234", 13, 21],
    ["Identity: ABCD1234", 10, 18],
    ["Tonga: 12345678", 7, 15],
    ["Tonga: 1234567890", 7, 17],
    ["Tonga:ABCD1234", 6, 14],
    ["Tonga# ABCD1234", 7, 15],
    ["Tonga#ABCD1234", 6, 14],
    ["tonga: abcd1234", 7, 15],
    ["TONGA: ABCD1234", 7, 15],
    ["Tonga:\tABCD1234", 7, 15],
    ["Tonga: \t ABCD1234", 9, 17],
    ["ABCD1234 (Tonga)", 0, 8],
    ["ABCD1234 Tonga", 0, 8],
    ["ABCD1234\t(Tonga)", 0, 8],
    ["Tonga: ABCD1234.", 7, 15],
    ["(Tonga: ABCD1234)", 8, 16],
  ])("positive: %s", (input, start, end) => {
    const detections = toIdDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "to_id",
      entityType: "to_id",
      reasons: ["to_id.format", "to_id.context"],
    });
  });

  test.each([
    ["ABCD1234", "no context"],
    ["Reference: ABCD1234", "non-approved label"],
    ["myTonga: ABCD1234", "label not whole — my prefix"],
    ["Tongax: ABCD1234", "label not whole — x suffix"],
    ["Tonga:\nABCD1234", "newline between label and candidate"],
    ["Tonga:         ABCD1234", "9 spaces exceeds 0-8"],
    ["ABCD1234(Tonga)", "0 spaces before paren — following requires 1-8"],
    ["ABCD1234 (Tonga", "missing closing paren"],
    ["Tonga: ABCD1234_", "underscore after candidate"],
    ["_Tonga: ABCD1234", "underscore before label"],
    ["Tonga: ABCD1234\u0301", "combining mark after candidate"],
    ["Tonga: ABCD123", "7 chars — too few"],
    ["Tonga: ABCD12345678", "11 chars — too many"],
  ])("negative: %s (%s)", (input) => {
    const detections = toIdDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Tonga: ABCD1234 and Tonga: WXYZ5678";
    const detections = toIdDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(7);
    expect(detections[0]?.end).toBe(15);
    expect(detections[1]?.start).toBe(27);
    expect(detections[1]?.end).toBe(35);
  });

  test("detector metadata", () => {
    expect(toIdDetector.id).toBe("to_id");
    expect(toIdDetector.entityType).toBe("to_id");
    expect(toIdDetector.replacement).toBe("[TO_ID]");
    expect(toIdDetector.stream).toEqual({
      maxMatchLength: 10,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
