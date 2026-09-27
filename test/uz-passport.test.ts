import { describe, expect, test } from "bun:test";
import { uzPassportDetector } from "../src/detectors/national-id/uz-passport";

describe("Uzbekistan Passport detector", () => {
  test.each([
    "Passport: AB1234567",
    "Uzbek Passport: AB1234567",
    "Uzbekistan Passport: AB1234567",
    "Pasport: AB1234567",
    "Passport:AB1234567",
    "Passport# AB1234567",
    "Passport#AB1234567",
    "Passport:\tAB1234567",
    "AB1234567 (Passport)",
    "AB1234567 Passport",
    "AB1234567\t(Passport)",
    "Passport: AB1234567.",
    "(Passport: AB1234567)",
  ])("positive: %s", (input) => {
    const detections = uzPassportDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "uz_passport",
      entityType: "uz_passport",
      reasons: ["uz_passport.format", "uz_passport.context"],
    });
    expect(input.slice(detections[0]!.start, detections[0]!.end)).toMatch(
      /[A-Z]{2}\d{7}/,
    );
  });

  test.each([
    ["AB1234567", "no context"],
    ["Reference: AB1234567", "non-approved label"],
    ["myPassport: AB1234567", "label not whole — my prefix"],
    ["Passportx: AB1234567", "label not whole — x suffix"],
    ["Passport:\nAB1234567", "newline between label and candidate"],
    ["Passport:         AB1234567", "9 spaces exceeds 0-8"],
    ["AB1234567(Passport)", "0 spaces before paren — following requires 1-8"],
    ["AB1234567 (Passport", "missing closing paren"],
    ["AB1234567x (Passport)", "letter after candidate before following label"],
    ["Passport: AB12345678", "10 chars — too many"],
    ["Passport: A1234567", "8 chars — too few"],
    ["Passport: AB1234567_", "underscore after candidate"],
    ["_Passport: AB1234567", "underscore before label"],
    ["Passport: AB1234567\u0301", "combining mark after candidate"],
    ["Passport: xAB1234567", "letter before candidate"],
    ["Passport: AB1234567x", "letter after candidate"],
    ["passport: ab1234567", "lowercase pattern does not match"],
  ])("negative: %s (%s)", (input) => {
    const detections = uzPassportDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Passport: AB1234567 and Passport: CD7654321";
    const detections = uzPassportDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]!.start, detections[0]!.end)).toBe(
      "AB1234567",
    );
    expect(text.slice(detections[1]!.start, detections[1]!.end)).toBe(
      "CD7654321",
    );
  });

  test("detector metadata", () => {
    expect(uzPassportDetector.id).toBe("uz_passport");
    expect(uzPassportDetector.entityType).toBe("uz_passport");
    expect(uzPassportDetector.replacement).toBe("[UZ_PASSPORT]");
    expect(uzPassportDetector.stream).toEqual({
      maxMatchLength: 9,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
