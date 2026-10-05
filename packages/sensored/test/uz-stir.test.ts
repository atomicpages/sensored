import { describe, expect, test } from "bun:test";
import { uzStirDetector } from "../src/detectors/national-id/uz-stir";

describe("Uzbekistan STIR (Tax ID) detector", () => {
  test.each([
    "STIR: 123456789",
    "Uzbek STIR: 123456789",
    "Uzbekistan STIR: 123456789",
    "Tax: 123456789",
    "INN: 123456789",
    "Soliq: 123456789",
    "STIR:123456789",
    "STIR# 123456789",
    "STIR#123456789",
    "stir: 123456789",
    "STIR:\t123456789",
    "123456789 (STIR)",
    "123456789 STIR",
    "123456789\t(STIR)",
    "STIR: 123456789.",
    "(STIR: 123456789)",
  ])("positive: %s", (input) => {
    const detections = uzStirDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "uz_stir",
      entityType: "uz_stir",
      reasons: ["uz_stir.format", "uz_stir.context"],
    });
    expect(input.slice(detections[0]?.start, detections[0]?.end)).toBe(
      "123456789",
    );
  });

  test.each([
    ["123456789", "no context"],
    ["Reference: 123456789", "non-approved label"],
    ["mySTIR: 123456789", "label not whole — my prefix"],
    ["STIRx: 123456789", "label not whole — x suffix"],
    ["STIR:\n123456789", "newline between label and candidate"],
    ["STIR:         123456789", "9 spaces exceeds 0-8"],
    ["123456789(STIR)", "0 spaces before paren — following requires 1-8"],
    ["123456789 (STIR", "missing closing paren"],
    ["123456789x (STIR)", "letter after candidate before following label"],
    ["STIR: 1234567890", "10 digits — too many"],
    ["STIR: 12345678", "8 digits — too few"],
    ["STIR: 123456789_", "underscore after candidate"],
    ["_STIR: 123456789", "underscore before label"],
    ["STIR: 123456789\u0301", "combining mark after candidate"],
    ["STIR: 0123456789", "digit before candidate"],
    ["STIR: 1234567890", "digit after candidate"],
  ])("negative: %s (%s)", (input) => {
    const detections = uzStirDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "STIR: 123456789 and STIR: 987654321";
    const detections = uzStirDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]?.start, detections[0]?.end)).toBe(
      "123456789",
    );
    expect(text.slice(detections[1]?.start, detections[1]?.end)).toBe(
      "987654321",
    );
  });

  test("detector metadata", () => {
    expect(uzStirDetector.id).toBe("uz_stir");
    expect(uzStirDetector.entityType).toBe("uz_stir");
    expect(uzStirDetector.replacement).toBe("[UZ_STIR]");
    expect(uzStirDetector.stream).toEqual({
      maxMatchLength: 9,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
