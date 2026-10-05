import { describe, expect, test } from "bun:test";
import { fjIdDetector } from "../src/detectors/national-id/fj-id";

describe("Fiji National ID detector", () => {
  test.each([
    ["Fiji: ABCD1234", 6, 14],
    ["Fijian: ABCD1234", 8, 16],
    ["National ID: ABCD1234", 13, 21],
    ["Identity: ABCD1234", 10, 18],
    ["Fiji: 12345678", 6, 14],
    ["Fiji: 1234567890", 6, 16],
    ["Fiji:ABCD1234", 5, 13],
    ["Fiji# ABCD1234", 6, 14],
    ["Fiji#ABCD1234", 5, 13],
    ["fiji: abcd1234", 6, 14],
    ["FIJI: ABCD1234", 6, 14],
    ["Fiji:\tABCD1234", 6, 14],
    ["Fiji: \t ABCD1234", 8, 16],
    ["ABCD1234 (Fiji)", 0, 8],
    ["ABCD1234 Fiji", 0, 8],
    ["ABCD1234\t(Fiji)", 0, 8],
    ["Fiji: ABCD1234.", 6, 14],
    ["(Fiji: ABCD1234)", 7, 15],
  ])("positive: %s", (input, start, end) => {
    const detections = fjIdDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "fj_id",
      entityType: "fj_id",
      reasons: ["fj_id.format", "fj_id.context"],
    });
  });

  test.each([
    ["ABCD1234", "no context"],
    ["Reference: ABCD1234", "non-approved label"],
    ["myFiji: ABCD1234", "label not whole — my prefix"],
    ["Fijix: ABCD1234", "label not whole — x suffix"],
    ["Fiji:\nABCD1234", "newline between label and candidate"],
    ["Fiji:         ABCD1234", "9 spaces exceeds 0-8"],
    ["ABCD1234(Fiji)", "0 spaces before paren — following requires 1-8"],
    ["ABCD1234 (Fiji", "missing closing paren"],
    ["Fiji: ABCD1234_", "underscore after candidate"],
    ["_Fiji: ABCD1234", "underscore before label"],
    ["Fiji: ABCD1234\u0301", "combining mark after candidate"],
    ["Fiji: ABCD123", "7 chars — too few"],
    ["Fiji: ABCD12345678", "12 chars — too many"],
  ])("negative: %s (%s)", (input) => {
    const detections = fjIdDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Fiji: ABCD1234 and Fiji: WXYZ5678";
    const detections = fjIdDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(6);
    expect(detections[0]?.end).toBe(14);
    expect(detections[1]?.start).toBe(25);
    expect(detections[1]?.end).toBe(33);
  });

  test("detector metadata", () => {
    expect(fjIdDetector.id).toBe("fj_id");
    expect(fjIdDetector.entityType).toBe("fj_id");
    expect(fjIdDetector.replacement).toBe("[FJ_ID]");
    expect(fjIdDetector.stream).toEqual({
      maxMatchLength: 10,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
