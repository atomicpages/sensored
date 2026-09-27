import { describe, expect, test } from "bun:test";
import { ruSnilsDetector } from "../src/detectors/national-id/ru-snils";

describe("RU SNILS detector", () => {
  test.each([
    "SNILS: 123-456-789 00",
    "SNILS: 123-456-78900",
    "Russia SNILS: 123-456-789 00",
    "Russian SNILS: 123-456-78900",
    "Pension: 123-456-789 00",
    "Пенсионный: 123-456-789 00",
    "СНИЛС: 123-456-78900",
    "SNILS:123-456-789 00",
    "SNILS# 123-456-789 00",
    "SNILS#123-456-78900",
    "snils: 123-456-789 00",
    "SNILS:\t123-456-789 00",
    "123-456-789 00 (SNILS)",
    "123-456-78900 (SNILS)",
    "123-456-789 00 SNILS",
    "123-456-789 00\t(SNILS)",
    "SNILS: 123-456-789 00.",
    "(SNILS: 123-456-789 00)",
  ])("positive: %s", (input) => {
    const detections = ruSnilsDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "ru_snils",
      entityType: "ru_snils",
      reasons: ["ru_snils.format", "ru_snils.context"],
    });
    expect(input.slice(detections[0]!.start, detections[0]!.end)).toMatch(
      /\d{3}-\d{3}-\d{3}\s?\d{2}/,
    );
  });

  test.each([
    ["Reference: 123-456-789 00", "non-approved label"],
    ["123-456-789 00", "no context"],
    ["mySNILS: 123-456-789 00", "label not whole — my prefix"],
    ["SNILSx: 123-456-789 00", "label not whole — x suffix"],
    ["SNILS:\n123-456-789 00", "newline between label and candidate"],
    ["SNILS:         123-456-789 00", "9 spaces exceeds 0-8"],
    ["123-456-789 00(SNILS)", "0 spaces before paren — following requires 1-8"],
    ["123-456-789 00 (SNILS", "missing closing paren"],
    [
      "123-456-789 00x (SNILS)",
      "letter after candidate before following label",
    ],
    ["SNILS: 123-456-789 000", "digit after candidate"],
    ["SNILS: 0123-456-789 00", "digit before candidate"],
    ["SNILS: 123-456-789 00_", "underscore after candidate"],
    ["_SNILS: 123-456-789 00", "underscore before label"],
    ["SNILS: 123-456-789 00\u0301", "combining mark after candidate"],
    ["SNILS: 123-45-789 00", "wrong group sizes"],
    ["SNILS: 1234-567-89 00", "wrong group sizes 2"],
    ["SNILS: 123-456-78 00", "too few digits"],
  ])("negative: %s (%s)", (input) => {
    const detections = ruSnilsDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "SNILS: 123-456-789 00 and SNILS: 987-654-321 99";
    const detections = ruSnilsDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]!.start, detections[0]!.end)).toBe(
      "123-456-789 00",
    );
    expect(text.slice(detections[1]!.start, detections[1]!.end)).toBe(
      "987-654-321 99",
    );
  });

  test("detector metadata", () => {
    expect(ruSnilsDetector.id).toBe("ru_snils");
    expect(ruSnilsDetector.entityType).toBe("ru_snils");
    expect(ruSnilsDetector.replacement).toBe("[RU_SNILS]");
    expect(ruSnilsDetector.stream).toEqual({
      maxMatchLength: 14,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
