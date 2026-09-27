import { describe, expect, test } from "bun:test";
import { nzIrdExtraDetector } from "../src/detectors/national-id/nz-ird-extra";

describe("New Zealand IRD Extra detector", () => {
  test.each([
    ["NZ IRD: 12345678", 8, 16],
    ["New Zealand IRD: 12345678", 17, 25],
    ["IRD: 12345678", 5, 13],
    ["Tax: 12345678", 5, 13],
    ["Inland Revenue: 12345678", 16, 24],
    ["NZ Tax: 123456789", 8, 17],
    ["IRD: 123456789", 5, 14],
    ["IRD:12345678", 4, 12],
    ["IRD# 12345678", 5, 13],
    ["IRD#12345678", 4, 12],
    ["ird: 12345678", 5, 13],
    ["IRD:\t12345678", 5, 13],
    ["IRD: \t 12345678", 7, 15],
    ["12345678 (IRD)", 0, 8],
    ["12345678 IRD", 0, 8],
    ["12345678\t(IRD)", 0, 8],
    ["IRD: 12345678.", 5, 13],
    ["(IRD: 12345678)", 6, 14],
    ["Tax: 123456789", 5, 14],
    ["Inland Revenue: 123456789", 16, 25],
  ])("positive: %s", (input, start, end) => {
    const detections = nzIrdExtraDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "nz_ird_extra",
      entityType: "nz_ird_extra",
      reasons: ["nz_ird_extra.format", "nz_ird_extra.context"],
    });
  });

  test.each([
    ["12345678", "no context"],
    ["Reference: 12345678", "non-approved label"],
    ["myIRD: 12345678", "label not whole — my prefix"],
    ["IRDx: 12345678", "label not whole — x suffix"],
    ["IRD:\n12345678", "newline between label and candidate"],
    ["IRD:         12345678", "9 spaces exceeds 0-8"],
    ["12345678(IRD)", "0 spaces before paren — following requires 1-8"],
    ["12345678 (IRD", "missing closing paren"],
    ["IRD: 12345678_", "underscore after candidate"],
    ["_IRD: 12345678", "underscore before label"],
    ["IRD: 12345678\u0301", "combining mark after candidate"],
    ["IRD: 1234567", "7 digits — too few"],
    ["IRD: 1234567890", "10 digits — too many"],
  ])("negative: %s (%s)", (input) => {
    const detections = nzIrdExtraDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "IRD: 12345678 and IRD: 87654321";
    const detections = nzIrdExtraDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(5);
    expect(detections[0]?.end).toBe(13);
    expect(detections[1]?.start).toBe(23);
    expect(detections[1]?.end).toBe(31);
  });

  test("detector metadata", () => {
    expect(nzIrdExtraDetector.id).toBe("nz_ird_extra");
    expect(nzIrdExtraDetector.entityType).toBe("nz_ird_extra");
    expect(nzIrdExtraDetector.replacement).toBe("[NZ_IRD_EXTRA]");
    expect(nzIrdExtraDetector.stream).toEqual({
      maxMatchLength: 9,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
