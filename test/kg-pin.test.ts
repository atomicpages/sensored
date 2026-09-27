import { describe, expect, test } from "bun:test";
import { kgPinDetector } from "../src/detectors/national-id/kg-pin";

describe("Kyrgyzstan PIN detector", () => {
  test.each([
    "PIN: 12345678901234",
    "Kyrgyz PIN: 12345678901234",
    "Kyrgyzstan PIN: 12345678901234",
    "Personal ID: 12345678901234",
    "Личный: 12345678901234",
    "Номер: 12345678901234",
    "PIN:12345678901234",
    "PIN# 12345678901234",
    "PIN#12345678901234",
    "pin: 12345678901234",
    "PIN:\t12345678901234",
    "12345678901234 (PIN)",
    "12345678901234 PIN",
    "12345678901234\t(PIN)",
    "PIN: 12345678901234.",
    "(PIN: 12345678901234)",
  ])("positive: %s", (input) => {
    const detections = kgPinDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "kg_pin",
      entityType: "kg_pin",
      reasons: ["kg_pin.format", "kg_pin.context"],
    });
    expect(input.slice(detections[0]!.start, detections[0]!.end)).toBe(
      "12345678901234",
    );
  });

  test.each([
    ["12345678901234", "no context"],
    ["Reference: 12345678901234", "non-approved label"],
    ["myPIN: 12345678901234", "label not whole — my prefix"],
    ["PINx: 12345678901234", "label not whole — x suffix"],
    ["PIN:\n12345678901234", "newline between label and candidate"],
    ["PIN:         12345678901234", "9 spaces exceeds 0-8"],
    ["12345678901234(PIN)", "0 spaces before paren — following requires 1-8"],
    ["12345678901234 (PIN", "missing closing paren"],
    ["12345678901234x (PIN)", "letter after candidate before following label"],
    ["PIN: 123456789012345", "15 digits — too many"],
    ["PIN: 1234567890123", "13 digits — too few"],
    ["PIN: 12345678901234_", "underscore after candidate"],
    ["_PIN: 12345678901234", "underscore before label"],
    ["PIN: 12345678901234\u0301", "combining mark after candidate"],
    ["PIN: 012345678901234", "digit before candidate"],
    ["PIN: 123456789012345", "digit after candidate"],
  ])("negative: %s (%s)", (input) => {
    const detections = kgPinDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "PIN: 12345678901234 and PIN: 56789012345678";
    const detections = kgPinDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]!.start, detections[0]!.end)).toBe(
      "12345678901234",
    );
    expect(text.slice(detections[1]!.start, detections[1]!.end)).toBe(
      "56789012345678",
    );
  });

  test("detector metadata", () => {
    expect(kgPinDetector.id).toBe("kg_pin");
    expect(kgPinDetector.entityType).toBe("kg_pin");
    expect(kgPinDetector.replacement).toBe("[KG_PIN]");
    expect(kgPinDetector.stream).toEqual({
      maxMatchLength: 14,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
