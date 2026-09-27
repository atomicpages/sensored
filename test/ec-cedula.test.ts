import { describe, expect, test } from "bun:test";
import { ecCedulaDetector } from "../src/detectors/national-id/ec-cedula";

function detect(text: string) {
  return ecCedulaDetector.detect(text);
}

describe("Ecuador Cédula detector", () => {
  test.each([
    ["Cédula: 1712345678", 8, 18],
    ["Cedula: 1712345678", 8, 18],
    ["Ecuador Cédula: 1712345678", 16, 26],
    ["Ecuadorian Cédula: 1712345678", 19, 29],
    ["Identidad: 1712345678", 11, 21],
    ["Cédula: 1712345678 here", 8, 18],
    ["1712345678 (Cédula)", 0, 10],
    ["1712345678 Cédula", 0, 10],
    ["cédula: 1712345678", 8, 18],
    ["Cédula:        1712345678", 15, 25],
  ])("detects %s", (input, start, end) => {
    const results = detect(input);
    expect(results).toHaveLength(1);
    expect(results[0]?.start).toBe(start);
    expect(results[0]?.end).toBe(end);
    expect(results[0]?.ruleId).toBe("ec_cedula");
    expect(results[0]?.entityType).toBe("ec_cedula");
    expect(results[0]?.reasons).toEqual([
      "ec_cedula.format",
      "ec_cedula.context",
    ]);
  });

  test.each([
    ["1712345678", "no context"],
    ["Reference: 1712345678", "wrong context"],
    ["Cédula: 0012345678", "invalid province 00"],
    ["Cédula: 2512345678", "invalid province 25"],
    ["Cédula: 1773456789", "invalid third digit 7"],
    ["Cédula: 1783456789", "invalid third digit 8"],
    ["Cédula: 123456789", "9 digits too short"],
    ["Cédula: 12345678901", "11 digits too long"],
    ["Cédula: 1712345678x", "letter after candidate"],
    ["xCédula: 1712345678", "letter before label"],
    ["Cédula: 1712345678_", "underscore after candidate"],
    ["_Cédula: 1712345678", "underscore before label"],
    ["Cédula:\n1712345678", "newline between label and candidate"],
    ["1712345678(Cédula)", "0 spaces before paren"],
    ["myCédula: 1712345678", "label not whole — my prefix"],
    ["Cédulax: 1712345678", "label not whole — x suffix"],
  ])("does not detect %s (%s)", (input) => {
    expect(detect(input)).toHaveLength(0);
  });

  test("detects multiple cédulas in text", () => {
    const results = detect("Cédula: 1712345678 and Cédula: 0212345678");
    expect(results).toHaveLength(2);
  });

  test("trailing period is not included in match", () => {
    const results = detect("Cédula: 1712345678.");
    expect(results).toHaveLength(1);
    expect(results[0]?.end).toBe(18);
  });

  test("id and replacement are correct", () => {
    expect(ecCedulaDetector.id).toBe("ec_cedula");
    expect(ecCedulaDetector.replacement).toBe("[EC_CEDULA]");
  });

  test("stream metadata is correct", () => {
    expect(ecCedulaDetector.stream).toEqual({
      maxMatchLength: 10,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
