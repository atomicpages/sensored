import { describe, expect, test } from "bun:test";
import { uaPassportDetector } from "../src/detectors/national-id/ua-passport";

describe("UA Passport detector", () => {
  test.each([
    "Passport: AB123456",
    "Ukrainian Passport: CD654321",
    "Паспорт: AB123456",
    "Український Паспорт: EF789012",
    "Passport:AB123456",
    "Passport# AB123456",
    "Passport#AB123456",
    "passport: AB123456",
    "PASSPORT: CD654321",
    "Passport:\tAB123456",
    "AB123456 (Passport)",
    "AB123456 Passport",
    "AB123456\t(Passport)",
    "Passport: AB123456.",
    "(Passport: AB123456)",
  ])("positive: %s", (input) => {
    const detections = uaPassportDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "ua_passport",
      entityType: "ua_passport",
      reasons: ["ua_passport.format", "ua_passport.context"],
    });
    expect(input.slice(detections[0]?.start, detections[0]?.end)).toMatch(
      /[A-Z]{2}\d{6}/,
    );
  });

  test.each([
    ["Reference: AB123456", "non-approved label"],
    ["AB123456", "no context"],
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
    ["Passport: A123456", "only 1 letter"],
    ["Passport: ABC123456", "3 letters"],
    ["Passport: AB12345", "5 digits"],
    ["Passport: AB1234567", "7 digits"],
    ["Passport: ab123456", "lowercase letters"],
  ])("negative: %s (%s)", (input) => {
    const detections = uaPassportDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Passport: AB123456 and Passport: CD654321";
    const detections = uaPassportDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]?.start, detections[0]?.end)).toBe(
      "AB123456",
    );
    expect(text.slice(detections[1]?.start, detections[1]?.end)).toBe(
      "CD654321",
    );
  });

  test("detector metadata", () => {
    expect(uaPassportDetector.id).toBe("ua_passport");
    expect(uaPassportDetector.entityType).toBe("ua_passport");
    expect(uaPassportDetector.replacement).toBe("[UA_PASSPORT]");
    expect(uaPassportDetector.stream).toEqual({
      maxMatchLength: 8,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
