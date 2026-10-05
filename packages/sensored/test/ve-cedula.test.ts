import { describe, expect, test } from "bun:test";
import { veCedulaDetector } from "../src/detectors/national-id/ve-cedula";

function detect(text: string) {
  return veCedulaDetector.detect(text);
}

describe("Venezuela Cédula detector", () => {
  test.each([
    ["Cédula: V-12345678", 8, 18],
    ["Cédula: E-12345678", 8, 18],
    ["Venezuela Cédula: V-12345678", 18, 28],
    ["Venezuelan Cédula: V-12345678", 19, 29],
    ["Cedula: V-12345678", 8, 18],
    ["Identidad: V-12345678", 11, 21],
    ["CI: V-12345678", 4, 14],
    ["Cédula: V-12345678 here", 8, 18],
    ["V-12345678 (Cédula)", 0, 10],
    ["V-12345678 Cédula", 0, 10],
    ["cédula: v-12345678", 8, 18],
    ["Cédula:        V-12345678", 15, 25],
    ["Cédula: V-1", 8, 11],
  ])("detects %s", (input, start, end) => {
    const results = detect(input);
    expect(results).toHaveLength(1);
    expect(results[0]?.start).toBe(start);
    expect(results[0]?.end).toBe(end);
    expect(results[0]?.ruleId).toBe("ve_cedula");
    expect(results[0]?.entityType).toBe("ve_cedula");
    expect(results[0]?.reasons).toEqual([
      "ve_cedula.format",
      "ve_cedula.context",
    ]);
  });

  test.each([
    ["V-12345678", "no context"],
    ["Reference: V-12345678", "wrong context"],
    ["Cédula: X-12345678", "invalid prefix X"],
    ["Cédula: V12345678", "missing hyphen"],
    ["Cédula: V-12345678x", "letter after candidate"],
    ["xCédula: V-12345678", "letter before label"],
    ["Cédula: V-12345678_", "underscore after candidate"],
    ["_Cédula: V-12345678", "underscore before label"],
    ["Cédula:\nV-12345678", "newline between label and candidate"],
    ["V-12345678(Cédula)", "0 spaces before paren"],
    ["myCédula: V-12345678", "label not whole — my prefix"],
    ["Cédulax: V-12345678", "label not whole — x suffix"],
  ])("does not detect %s (%s)", (input) => {
    expect(detect(input)).toHaveLength(0);
  });

  test("detects multiple cédulas in text", () => {
    const results = detect("Cédula: V-12345678 and Cédula: E-87654321");
    expect(results).toHaveLength(2);
  });

  test("trailing period is not included in match", () => {
    const results = detect("Cédula: V-12345678.");
    expect(results).toHaveLength(1);
    expect(results[0]?.end).toBe(18);
  });

  test("id and replacement are correct", () => {
    expect(veCedulaDetector.id).toBe("ve_cedula");
    expect(veCedulaDetector.replacement).toBe("[VE_CEDULA]");
  });

  test("stream metadata is correct", () => {
    expect(veCedulaDetector.stream).toEqual({
      maxMatchLength: 10,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
