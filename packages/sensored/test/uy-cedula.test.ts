import { describe, expect, test } from "bun:test";
import { uyCedulaDetector } from "../src/detectors/national-id/uy-cedula";

function detect(text: string) {
  return uyCedulaDetector.detect(text);
}

describe("Uruguay Cédula detector", () => {
  test.each([
    ["Cédula: 1.234.567-8", 8, 19],
    ["Cedula: 1.234.567-8", 8, 19],
    ["Uruguay Cédula: 1.234.567-8", 16, 27],
    ["Uruguayan Cédula: 1.234.567-8", 18, 29],
    ["Identidad: 1.234.567-8", 11, 22],
    ["Cédula: 1.234.567-8 here", 8, 19],
    ["1.234.567-8 (Cédula)", 0, 11],
    ["1.234.567-8 Cédula", 0, 11],
    ["cédula: 1.234.567-8", 8, 19],
    ["Cédula:        1.234.567-8", 15, 26],
  ])("detects %s", (input, start, end) => {
    const results = detect(input);
    expect(results).toHaveLength(1);
    expect(results[0]?.start).toBe(start);
    expect(results[0]?.end).toBe(end);
    expect(results[0]?.ruleId).toBe("uy_cedula");
    expect(results[0]?.entityType).toBe("uy_cedula");
    expect(results[0]?.reasons).toEqual([
      "uy_cedula.format",
      "uy_cedula.context",
    ]);
  });

  test.each([
    ["1.234.567-8", "no context"],
    ["Reference: 1.234.567-8", "wrong context"],
    ["Cédula: 12.345.678-8", "wrong format — 2 digit prefix"],
    ["Cédula: 1.234.5678", "missing hyphen"],
    ["Cédula: 1.234.56-8", "too few body digits"],
    ["Cédula: 1.234.567-8x", "letter after candidate"],
    ["xCédula: 1.234.567-8", "letter before label"],
    ["Cédula: 1.234.567-8_", "underscore after candidate"],
    ["_Cédula: 1.234.567-8", "underscore before label"],
    ["Cédula:\n1.234.567-8", "newline between label and candidate"],
    ["1.234.567-8(Cédula)", "0 spaces before paren"],
    ["myCédula: 1.234.567-8", "label not whole — my prefix"],
    ["Cédulax: 1.234.567-8", "label not whole — x suffix"],
  ])("does not detect %s (%s)", (input) => {
    expect(detect(input)).toHaveLength(0);
  });

  test("detects multiple cédulas in text", () => {
    const results = detect("Cédula: 1.234.567-8 and Cédula: 2.345.678-9");
    expect(results).toHaveLength(2);
  });

  test("trailing period is not included in match", () => {
    const results = detect("Cédula: 1.234.567-8.");
    expect(results).toHaveLength(1);
    expect(results[0]?.end).toBe(19);
  });

  test("id and replacement are correct", () => {
    expect(uyCedulaDetector.id).toBe("uy_cedula");
    expect(uyCedulaDetector.replacement).toBe("[UY_CEDULA]");
  });

  test("stream metadata is correct", () => {
    expect(uyCedulaDetector.stream).toEqual({
      maxMatchLength: 11,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
