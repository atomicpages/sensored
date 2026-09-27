import { describe, expect, test } from "bun:test";
import { wsIdDetector } from "../src/detectors/national-id/ws-id";

describe("Samoa National ID detector", () => {
  test.each([
    ["Samoa: 12345678", 7, 15],
    ["Samoan: 12345678", 8, 16],
    ["National ID: 12345678", 13, 21],
    ["Identity: 12345678", 10, 18],
    ["Samoa: 1234567890", 7, 17],
    ["Samoa: 123456789", 7, 16],
    ["Samoa:12345678", 6, 14],
    ["Samoa# 12345678", 7, 15],
    ["Samoa#12345678", 6, 14],
    ["samoa: 12345678", 7, 15],
    ["SAMOA: 12345678", 7, 15],
    ["Samoa:\t12345678", 7, 15],
    ["Samoa: \t 12345678", 9, 17],
    ["12345678 (Samoa)", 0, 8],
    ["12345678 Samoa", 0, 8],
    ["12345678\t(Samoa)", 0, 8],
    ["Samoa: 12345678.", 7, 15],
    ["(Samoa: 12345678)", 8, 16],
  ])("positive: %s", (input, start, end) => {
    const detections = wsIdDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "ws_id",
      entityType: "ws_id",
      reasons: ["ws_id.format", "ws_id.context"],
    });
  });

  test.each([
    ["12345678", "no context"],
    ["Reference: 12345678", "non-approved label"],
    ["mySamoa: 12345678", "label not whole — my prefix"],
    ["Samoax: 12345678", "label not whole — x suffix"],
    ["Samoa:\n12345678", "newline between label and candidate"],
    ["Samoa:         12345678", "9 spaces exceeds 0-8"],
    ["12345678(Samoa)", "0 spaces before paren — following requires 1-8"],
    ["12345678 (Samoa", "missing closing paren"],
    ["Samoa: 12345678_", "underscore after candidate"],
    ["_Samoa: 12345678", "underscore before label"],
    ["Samoa: 12345678\u0301", "combining mark after candidate"],
    ["Samoa: 1234567", "7 digits — too few"],
    ["Samoa: 12345678901", "11 digits — too many"],
    ["Samoa: ABCD1234", "letters not digits"],
  ])("negative: %s (%s)", (input) => {
    const detections = wsIdDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Samoa: 12345678 and Samoa: 87654321";
    const detections = wsIdDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(7);
    expect(detections[0]?.end).toBe(15);
    expect(detections[1]?.start).toBe(27);
    expect(detections[1]?.end).toBe(35);
  });

  test("detector metadata", () => {
    expect(wsIdDetector.id).toBe("ws_id");
    expect(wsIdDetector.entityType).toBe("ws_id");
    expect(wsIdDetector.replacement).toBe("[WS_ID]");
    expect(wsIdDetector.stream).toEqual({
      maxMatchLength: 10,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
