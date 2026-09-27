import { describe, expect, test } from "bun:test";
import { pngIdDetector } from "../src/detectors/national-id/png-id";

describe("Papua New Guinea National ID detector", () => {
  test.each([
    ["Papua: ABCD1234", 7, 15],
    ["New Guinea: ABCD1234", 12, 20],
    ["National ID: ABCD1234", 13, 21],
    ["Papua: 12345678", 7, 15],
    ["Papua: 123456789012", 7, 19],
    ["Papua: ABCD12345678", 7, 19],
    ["Papua:ABCD1234", 6, 14],
    ["Papua# ABCD1234", 7, 15],
    ["Papua#ABCD1234", 6, 14],
    ["papua: abcd1234", 7, 15],
    ["Papua:\tABCD1234", 7, 15],
    ["Papua: \t ABCD1234", 9, 17],
    ["ABCD1234 (Papua)", 0, 8],
    ["ABCD1234 Papua", 0, 8],
    ["ABCD1234\t(Papua)", 0, 8],
    ["Papua: ABCD1234.", 7, 15],
    ["(Papua: ABCD1234)", 8, 16],
  ])("positive: %s", (input, start, end) => {
    const detections = pngIdDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "png_id",
      entityType: "png_id",
      reasons: ["png_id.format", "png_id.context"],
    });
  });

  test.each([
    ["ABCD1234", "no context"],
    ["Reference: ABCD1234", "non-approved label"],
    ["myPapua: ABCD1234", "label not whole — my prefix"],
    ["Papuax: ABCD1234", "label not whole — x suffix"],
    ["Papua:\nABCD1234", "newline between label and candidate"],
    ["Papua:         ABCD1234", "9 spaces exceeds 0-8"],
    ["ABCD1234(Papua)", "0 spaces before paren — following requires 1-8"],
    ["ABCD1234 (Papua", "missing closing paren"],
    ["Papua: ABCD1234_", "underscore after candidate"],
    ["_Papua: ABCD1234", "underscore before label"],
    ["Papua: ABCD1234\u0301", "combining mark after candidate"],
    ["Papua: ABCD123", "7 chars — too few"],
    ["Papua: ABCD1234567890", "13 chars — too many"],
  ])("negative: %s (%s)", (input) => {
    const detections = pngIdDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Papua: ABCD1234 and Papua: WXYZ5678";
    const detections = pngIdDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(7);
    expect(detections[0]?.end).toBe(15);
    expect(detections[1]?.start).toBe(27);
    expect(detections[1]?.end).toBe(35);
  });

  test("detector metadata", () => {
    expect(pngIdDetector.id).toBe("png_id");
    expect(pngIdDetector.entityType).toBe("png_id");
    expect(pngIdDetector.replacement).toBe("[PNG_ID]");
    expect(pngIdDetector.stream).toEqual({
      maxMatchLength: 12,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
