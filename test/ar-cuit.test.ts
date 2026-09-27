import { describe, expect, test } from "bun:test";
import { arCuitDetector } from "../src/detectors/national-id/ar-cuit";

function detect(text: string) {
  return arCuitDetector.detect(text);
}

describe("Argentina CUIT/CUIL detector", () => {
  test.each([
    ["CUIT: 20-12345678-3", 6, 19],
    ["CUIL: 27-87654321-5", 6, 19],
    ["Argentina CUIT: 30-12345678-1", 16, 29],
    ["Tax: 20-12345678-3", 5, 18],
    ["Impuesto: 20-12345678-3", 10, 23],
    ["Tributario: 20-12345678-3", 12, 25],
    ["CUIT: 20-12345678-3 here", 6, 19],
    ["20-12345678-3 (CUIT)", 0, 13],
    ["20-12345678-3 CUIT", 0, 13],
    ["cuit: 20-12345678-3", 6, 19],
    ["CUIT:        20-12345678-3", 13, 26],
  ])("detects %s", (input, start, end) => {
    const results = detect(input);
    expect(results).toHaveLength(1);
    expect(results[0]?.start).toBe(start);
    expect(results[0]?.end).toBe(end);
    expect(results[0]?.ruleId).toBe("ar_cuit");
    expect(results[0]?.entityType).toBe("ar_cuit");
    expect(results[0]?.reasons).toEqual(["ar_cuit.format", "ar_cuit.context"]);
  });

  test.each([
    ["20-12345678-3", "no context"],
    ["Reference: 20-12345678-3", "wrong context"],
    ["CUIT: 20-12345678", "missing check digit"],
    ["CUIT: 20-1234567-3", "too few body digits"],
    ["CUIT: 20-123456789-3", "too many body digits"],
    ["CUIT: 2-12345678-3", "too few prefix digits"],
    ["CUIT: 200-12345678-3", "too many prefix digits"],
    ["CUIT: 20-12345678-3x", "letter after candidate"],
    ["xCUIT: 20-12345678-3", "letter before label"],
    ["CUIT: 20-12345678-3_", "underscore after candidate"],
    ["_CUIT: 20-12345678-3", "underscore before label"],
    ["CUIT:\n20-12345678-3", "newline between label and candidate"],
    ["20-12345678-3(CUIT)", "0 spaces before paren"],
    ["myCUIT: 20-12345678-3", "label not whole — my prefix"],
    ["CUITx: 20-12345678-3", "label not whole — x suffix"],
  ])("does not detect %s (%s)", (input) => {
    expect(detect(input)).toHaveLength(0);
  });

  test("detects multiple CUITs in text", () => {
    const results = detect("CUIT: 20-12345678-3 and CUIT: 30-87654321-5");
    expect(results).toHaveLength(2);
  });

  test("trailing period is not included in match", () => {
    const results = detect("CUIT: 20-12345678-3.");
    expect(results).toHaveLength(1);
    expect(results[0]?.end).toBe(19);
  });

  test("id and replacement are correct", () => {
    expect(arCuitDetector.id).toBe("ar_cuit");
    expect(arCuitDetector.replacement).toBe("[AR_CUIT]");
  });

  test("stream metadata is correct", () => {
    expect(arCuitDetector.stream).toEqual({
      maxMatchLength: 13,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
