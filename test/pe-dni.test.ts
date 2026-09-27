import { describe, expect, test } from "bun:test";
import { peDniDetector } from "../src/detectors/national-id/pe-dni";

function detect(text: string) {
  return peDniDetector.detect(text);
}

describe("Peru DNI detector", () => {
  test.each([
    ["DNI: 12345678", 5, 13],
    ["Peru DNI: 12345678", 10, 18],
    ["Peruvian DNI: 12345678", 14, 22],
    ["Perú DNI: 12345678", 10, 18],
    ["Peruano DNI: 12345678", 13, 21],
    ["Documento Nacional: 12345678", 20, 28],
    ["Identidad: 12345678", 11, 19],
    ["RENIEC: 12345678", 8, 16],
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
    expect(results[0]?.ruleId).toBe("pe_dni");
    expect(results[0]?.entityType).toBe("pe_dni");
    expect(results[0]?.reasons).toEqual(["pe_dni.format", "pe_dni.context"]);
  });

  test.each([
    ["12345678", "no context"],
    ["Reference: 12345678", "wrong context"],
    ["DNI: 1234567", "7 digits too short"],
    ["DNI: 123456789", "9 digits too long"],
    ["DNI: 12345678x", "letter after candidate"],
    ["xDNI: 12345678", "letter before label"],
    ["DNI: 12345678_", "underscore after candidate"],
    ["_DNI: 12345678", "underscore before label"],
    ["DNI:\n12345678", "newline between label and candidate"],
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
    expect(peDniDetector.id).toBe("pe_dni");
    expect(peDniDetector.replacement).toBe("[PE_DNI]");
  });

  test("stream metadata is correct", () => {
    expect(peDniDetector.stream).toEqual({
      maxMatchLength: 8,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
