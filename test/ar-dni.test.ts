import { describe, expect, test } from "bun:test";
import { arDniDetector } from "../src/detectors/national-id/ar-dni";

function detect(text: string) {
  return arDniDetector.detect(text);
}

describe("Argentina DNI detector", () => {
  test.each([
    ["DNI: 12345678", 5, 13],
    ["DNI: 1234567", 5, 12],
    ["Argentina DNI: 12345678", 15, 23],
    ["Documento Nacional 12345678", 19, 27],
    ["Identidad: 12345678", 11, 19],
    ["DNI: 12345678 here", 5, 13],
    ["12345678 (DNI)", 0, 8],
    ["12345678 DNI", 0, 8],
    ["dni: 12345678", 5, 13],
    ["DNI:        12345678", 12, 20],
  ])("detects %s", (input, start, end) => {
    const results = detect(input);
    expect(results).toHaveLength(1);
    expect(results[0]?.start).toBe(start);
    expect(results[0]?.end).toBe(end);
    expect(results[0]?.ruleId).toBe("ar_dni");
    expect(results[0]?.entityType).toBe("ar_dni");
    expect(results[0]?.reasons).toEqual(["ar_dni.format", "ar_dni.context"]);
  });

  test.each([
    ["12345678", "no context"],
    ["Reference: 12345678", "wrong context"],
    ["DNI: 123456", "6 digits too short"],
    ["DNI: 123456789", "9 digits too long"],
    ["DNI: 12345678x", "letter after candidate"],
    ["xDNI: 12345678", "letter before label"],
    ["DNI: 12345678_", "underscore after candidate"],
    ["_DNI: 12345678", "underscore before label"],
    ["DNI:\n12345678", "newline between label and candidate"],
    ["DNI:         12345678", "9 spaces exceeds 0-8"],
    ["12345678(DNI)", "0 spaces before paren"],
    ["myDNI: 12345678", "label not whole — my prefix"],
    ["DNIx: 12345678", "label not whole — x suffix"],
  ])("does not detect %s (%s)", (input) => {
    expect(detect(input)).toHaveLength(0);
  });

  test("detects multiple DNIs in text", () => {
    const results = detect("DNI: 12345678 and DNI: 87654321");
    expect(results).toHaveLength(2);
  });

  test("trailing period is not included in match", () => {
    const results = detect("DNI: 12345678.");
    expect(results).toHaveLength(1);
    expect(results[0]?.end).toBe(13);
  });

  test("id and replacement are correct", () => {
    expect(arDniDetector.id).toBe("ar_dni");
    expect(arDniDetector.replacement).toBe("[AR_DNI]");
  });

  test("stream metadata is correct", () => {
    expect(arDniDetector.stream).toEqual({
      maxMatchLength: 8,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
