import { describe, expect, test } from "bun:test";
import { huTaxIdDetector } from "../src/detectors/national-id/hu-tax-id";

describe("HU Tax ID detector", () => {
  test.each([
    "Hungarian: 1234567890",
    "Magyar: 1234567890",
    "Adó: 1234567890",
    "Tax: 1234567890",
    "Adóazonosító: 1234567890",
    "Tax:1234567890",
    "Tax# 1234567890",
    "Tax#1234567890",
    "tax: 1234567890",
    "TAX: 1234567890",
    "Tax:\t1234567890",
    "1234567890 (Tax)",
    "1234567890 Tax",
    "1234567890\t(Tax)",
    "Tax: 1234567890.",
    "(Tax: 1234567890)",
  ])("positive: %s", (input) => {
    const detections = huTaxIdDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "hu_tax_id",
      entityType: "hu_tax_id",
      reasons: ["hu_tax_id.format", "hu_tax_id.context"],
    });
    expect(input.slice(detections[0]?.start, detections[0]?.end)).toMatch(
      /\d{10}/,
    );
  });

  test.each([
    ["Reference: 1234567890", "non-approved label"],
    ["1234567890", "no context"],
    ["myTax: 1234567890", "label not whole — my prefix"],
    ["Taxx: 1234567890", "label not whole — x suffix"],
    ["Tax:\n1234567890", "newline between label and candidate"],
    ["Tax:         1234567890", "9 spaces exceeds 0-8"],
    ["1234567890(Tax)", "0 spaces before paren — following requires 1-8"],
    ["1234567890 (Tax", "missing closing paren"],
    ["1234567890x (Tax)", "letter after candidate before following label"],
    ["Tax: 12345678901", "digit after candidate"],
    ["Tax: 01234567890", "digit before candidate"],
    ["Tax: 1234567890_", "underscore after candidate"],
    ["_Tax: 1234567890", "underscore before label"],
    ["Tax: 1234567890\u0301", "combining mark after candidate"],
    ["Tax: 123456789", "9 digits"],
    ["Tax: 12345678901", "11 digits"],
  ])("negative: %s (%s)", (input) => {
    const detections = huTaxIdDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Tax: 1234567890 and Tax: 9876543210";
    const detections = huTaxIdDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]?.start, detections[0]?.end)).toBe(
      "1234567890",
    );
    expect(text.slice(detections[1]?.start, detections[1]?.end)).toBe(
      "9876543210",
    );
  });

  test("detector metadata", () => {
    expect(huTaxIdDetector.id).toBe("hu_tax_id");
    expect(huTaxIdDetector.entityType).toBe("hu_tax_id");
    expect(huTaxIdDetector.replacement).toBe("[HU_TAX_ID]");
    expect(huTaxIdDetector.stream).toEqual({
      maxMatchLength: 10,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
