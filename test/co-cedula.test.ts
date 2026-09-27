import { describe, expect, test } from "bun:test";
import { coCedulaDetector } from "../src/detectors/national-id/co-cedula";

function detect(text: string) {
  return coCedulaDetector.detect(text);
}

describe("Colombia Cédula detector", () => {
  test.each([
    ["Cédula: 1234567890", 8, 18],
    ["Cedula: 123456", 8, 14],
    ["Colombia Cédula: 1234567890", 17, 27],
    ["Colombian Cédula: 1234567890", 18, 28],
    ["Ciudadanía: 1234567890", 12, 22],
    ["CC: 1234567890", 4, 14],
    ["Cédula: 1234567890 here", 8, 18],
    ["1234567890 (Cédula)", 0, 10],
    ["1234567890 Cédula", 0, 10],
    ["cédula: 1234567890", 8, 18],
    ["Cédula:        1234567890", 15, 25],
  ])("detects %s", (input, start, end) => {
    const results = detect(input);
    expect(results).toHaveLength(1);
    expect(results[0]?.start).toBe(start);
    expect(results[0]?.end).toBe(end);
    expect(results[0]?.ruleId).toBe("co_cedula");
    expect(results[0]?.entityType).toBe("co_cedula");
    expect(results[0]?.reasons).toEqual([
      "co_cedula.format",
      "co_cedula.context",
    ]);
  });

  test.each([
    ["1234567890", "no context"],
    ["Reference: 1234567890", "wrong context"],
    ["Cédula: 12345", "5 digits too short"],
    ["Cédula: 12345678901", "11 digits too long"],
    ["Cédula: 1234567890x", "letter after candidate"],
    ["xCédula: 1234567890", "letter before label"],
    ["Cédula: 1234567890_", "underscore after candidate"],
    ["_Cédula: 1234567890", "underscore before label"],
    ["Cédula:\n1234567890", "newline between label and candidate"],
    ["1234567890(Cédula)", "0 spaces before paren"],
    ["myCédula: 1234567890", "label not whole — my prefix"],
    ["Cédulax: 1234567890", "label not whole — x suffix"],
  ])("does not detect %s (%s)", (input) => {
    expect(detect(input)).toHaveLength(0);
  });

  test("detects multiple cédulas in text", () => {
    const results = detect("Cédula: 1234567890 and Cédula: 9876543210");
    expect(results).toHaveLength(2);
  });

  test("trailing period is not included in match", () => {
    const results = detect("Cédula: 1234567890.");
    expect(results).toHaveLength(1);
    expect(results[0]?.end).toBe(18);
  });

  test("id and replacement are correct", () => {
    expect(coCedulaDetector.id).toBe("co_cedula");
    expect(coCedulaDetector.replacement).toBe("[CO_CEDULA]");
  });

  test("stream metadata is correct", () => {
    expect(coCedulaDetector.stream).toEqual({
      maxMatchLength: 10,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
