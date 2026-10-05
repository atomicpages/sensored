import { describe, expect, test } from "bun:test";
import { tmPassportDetector } from "../src/detectors/national-id/tm-passport";

describe("Turkmenistan Passport detector", () => {
  test.each([
    "Passport: A1234567",
    "Turkmen Passport: A1234567",
    "Turkmenistan Passport: A1234567",
    "Pasport: A1234567",
    "Passport:A1234567",
    "Passport# A1234567",
    "Passport#A1234567",
    "Passport:\tA1234567",
    "A1234567 (Passport)",
    "A1234567 Passport",
    "A1234567\t(Passport)",
    "Passport: A1234567.",
    "(Passport: A1234567)",
  ])("positive: %s", (input) => {
    const detections = tmPassportDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "tm_passport",
      entityType: "tm_passport",
      reasons: ["tm_passport.format", "tm_passport.context"],
    });
    expect(input.slice(detections[0]?.start, detections[0]?.end)).toMatch(
      /[A-Z]\d{7}/,
    );
  });

  test.each([
    ["A1234567", "no context"],
    ["Reference: A1234567", "non-approved label"],
    ["myPassport: A1234567", "label not whole — my prefix"],
    ["Passportx: A1234567", "label not whole — x suffix"],
    ["Passport:\nA1234567", "newline between label and candidate"],
    ["Passport:         A1234567", "9 spaces exceeds 0-8"],
    ["A1234567(Passport)", "0 spaces before paren — following requires 1-8"],
    ["A1234567 (Passport", "missing closing paren"],
    ["A1234567x (Passport)", "letter after candidate before following label"],
    ["Passport: AB1234567", "9 chars — too many"],
    ["Passport: 1234567", "7 digits only — no letter"],
    ["Passport: A12345678", "9 chars — too many"],
    ["Passport: A1234567_", "underscore after candidate"],
    ["_Passport: A1234567", "underscore before label"],
    ["Passport: A1234567\u0301", "combining mark after candidate"],
    ["Passport: xA1234567", "letter before candidate"],
    ["passport: a1234567", "lowercase pattern does not match"],
  ])("negative: %s (%s)", (input) => {
    const detections = tmPassportDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Passport: A1234567 and Passport: B7654321";
    const detections = tmPassportDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]?.start, detections[0]?.end)).toBe(
      "A1234567",
    );
    expect(text.slice(detections[1]?.start, detections[1]?.end)).toBe(
      "B7654321",
    );
  });

  test("detector metadata", () => {
    expect(tmPassportDetector.id).toBe("tm_passport");
    expect(tmPassportDetector.entityType).toBe("tm_passport");
    expect(tmPassportDetector.replacement).toBe("[TM_PASSPORT]");
    expect(tmPassportDetector.stream).toEqual({
      maxMatchLength: 8,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
