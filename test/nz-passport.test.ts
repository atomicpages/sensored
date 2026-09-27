import { describe, expect, test } from "bun:test";
import { nzPassportDetector } from "../src/detectors/national-id/nz-passport";

describe("New Zealand Passport detector", () => {
  test.each([
    ["Passport: AB123456", 10, 18],
    ["New Zealand Passport: AB123456", 22, 30],
    ["NZ Passport: AB123456", 13, 21],
    ["Travel Document: AB123456", 17, 25],
    ["Passport:AB123456", 9, 17],
    ["Passport# AB123456", 10, 18],
    ["Passport#AB123456", 9, 17],
    ["passport: ab123456", 10, 18],
    ["PASSPORT: AB123456", 10, 18],
    ["Passport:\tAB123456", 10, 18],
    ["Passport: \t AB123456", 12, 20],
    ["AB123456 (Passport)", 0, 8],
    ["AB123456 Passport", 0, 8],
    ["AB123456\t(Passport)", 0, 8],
    ["Passport: AB123456.", 10, 18],
    ["(Passport: AB123456)", 11, 19],
  ])("positive: %s", (input, start, end) => {
    const detections = nzPassportDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "nz_passport",
      entityType: "nz_passport",
      reasons: ["nz_passport.format", "nz_passport.context"],
    });
  });

  test.each([
    ["AB123456", "no context"],
    ["Reference: AB123456", "non-approved label"],
    ["myPassport: AB123456", "label not whole — my prefix"],
    ["Passportx: AB123456", "label not whole — x suffix"],
    ["Passport:\nAB123456", "newline between label and candidate"],
    ["Passport:         AB123456", "9 spaces exceeds 0-8"],
    ["AB123456(Passport)", "0 spaces before paren — following requires 1-8"],
    ["AB123456 (Passport", "missing closing paren"],
    ["AB123456x (Passport)", "letter after candidate before following label"],
    ["Passport: AB1234567", "digit after candidate"],
    ["Passport: 0AB123456", "digit before candidate"],
    ["Passport: AB123456_", "underscore after candidate"],
    ["_Passport: AB123456", "underscore before label"],
    ["Passport: AB123456\u0301", "combining mark after candidate"],
    ["Passport: AB12345", "7 chars — too few"],
    ["Passport: AB1234567", "9 chars — too many"],
    ["Passport: A123456", "1 letter — too few"],
    ["Passport: ABC123456", "3 letters — too many"],
  ])("negative: %s (%s)", (input) => {
    const detections = nzPassportDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Passport: AB123456 and Passport: CD654321";
    const detections = nzPassportDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(10);
    expect(detections[0]?.end).toBe(18);
    expect(detections[1]?.start).toBe(33);
    expect(detections[1]?.end).toBe(41);
  });

  test("detector metadata", () => {
    expect(nzPassportDetector.id).toBe("nz_passport");
    expect(nzPassportDetector.entityType).toBe("nz_passport");
    expect(nzPassportDetector.replacement).toBe("[NZ_PASSPORT]");
    expect(nzPassportDetector.stream).toEqual({
      maxMatchLength: 8,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
