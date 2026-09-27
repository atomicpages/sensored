import { describe, expect, test } from "bun:test";
import { ruPassportDetector } from "../src/detectors/national-id/ru-passport";

describe("RU Passport detector", () => {
  test.each([
    "Passport: 1234 567890",
    "Passport: 1234567890",
    "Russia Passport: 1234 567890",
    "Russian Passport: 1234567890",
    "Паспорт: 1234 567890",
    "Российский Паспорт: 1234567890",
    "Passport:1234 567890",
    "Passport# 1234 567890",
    "Passport#1234567890",
    "passport: 1234 567890",
    "PASSPORT: 1234567890",
    "Passport:\t1234 567890",
    "1234 567890 (Passport)",
    "1234567890 (Passport)",
    "1234 567890 Passport",
    "1234 567890\t(Passport)",
    "1234 567890        (Passport)",
    "Passport: 1234 567890.",
    "(Passport: 1234 567890)",
  ])("positive: %s", (input) => {
    const detections = ruPassportDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "ru_passport",
      entityType: "ru_passport",
      reasons: ["ru_passport.format", "ru_passport.context"],
    });
    expect(input.slice(detections[0]!.start, detections[0]!.end)).toMatch(
      /\d{4}\s?\d{6}/,
    );
  });

  test.each([
    ["Reference: 1234 567890", "non-approved label"],
    ["1234 567890", "no context"],
    ["myPassport: 1234 567890", "label not whole — my prefix"],
    ["Passportx: 1234 567890", "label not whole — x suffix"],
    ["Passport:\n1234 567890", "newline between label and candidate"],
    ["Passport:         1234 567890", "9 spaces exceeds 0-8"],
    ["1234 567890(Passport)", "0 spaces before paren — following requires 1-8"],
    ["1234 567890 (Passport", "missing closing paren"],
    [
      "1234 567890x (Passport)",
      "letter after candidate before following label",
    ],
    ["Passport: 1234 5678901", "digit after candidate"],
    ["Passport: 01234 567890", "digit before candidate"],
    ["Passport: 1234 567890_", "underscore after candidate"],
    ["_Passport: 1234 567890", "underscore before label"],
    ["Passport: 1234 567890\u0301", "combining mark after candidate"],
    ["Passport: 123456789", "9 digits compact"],
    ["Passport: 12345678901", "11 digits compact"],
    ["Passport: 123 567890", "wrong group sizes"],
    ["Passport: 12345 67890", "wrong split"],
  ])("negative: %s (%s)", (input) => {
    const detections = ruPassportDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Passport: 1234 567890 and Passport: 9876 543210";
    const detections = ruPassportDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]!.start, detections[0]!.end)).toBe(
      "1234 567890",
    );
    expect(text.slice(detections[1]!.start, detections[1]!.end)).toBe(
      "9876 543210",
    );
  });

  test("detector metadata", () => {
    expect(ruPassportDetector.id).toBe("ru_passport");
    expect(ruPassportDetector.entityType).toBe("ru_passport");
    expect(ruPassportDetector.replacement).toBe("[RU_PASSPORT]");
    expect(ruPassportDetector.stream).toEqual({
      maxMatchLength: 11,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
