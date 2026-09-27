import { describe, expect, test } from "bun:test";
import { clRutDetector } from "../src/detectors/national-id/cl-rut";

function detect(text: string) {
  return clRutDetector.detect(text);
}

describe("Chile RUT detector", () => {
  test.each([
    ["RUT: 12.345.678-5", 5, 17],
    ["RUT: 1.234.567-4", 5, 16],
    ["Chile RUT: 12.345.678-5", 11, 23],
    ["Chilean RUT: 12.345.678-5", 13, 25],
    ["Rol Único: 12.345.678-5", 11, 23],
    ["Tributario: 12.345.678-5", 12, 24],
    ["Cédula: 12.345.678-5", 8, 20],
    ["RUT: 12.345.678-5 here", 5, 17],
    ["12.345.678-5 (RUT)", 0, 12],
    ["12.345.678-5 RUT", 0, 12],
    ["rut: 12.345.678-5", 5, 17],
    ["RUT:        12.345.678-5", 12, 24],
  ])("detects %s", (input, start, end) => {
    const results = detect(input);
    expect(results).toHaveLength(1);
    expect(results[0]?.start).toBe(start);
    expect(results[0]?.end).toBe(end);
    expect(results[0]?.ruleId).toBe("cl_rut");
    expect(results[0]?.entityType).toBe("cl_rut");
    expect(results[0]?.reasons).toEqual(["cl_rut.checksum", "cl_rut.context"]);
  });

  test.each([
    ["12.345.678-5", "no context"],
    ["Reference: 12.345.678-5", "wrong context"],
    ["RUT: 12.345.678-0", "invalid checksum"],
    ["RUT: 12.345.678-3", "invalid checksum 2"],
    ["RUT: 12.345.678-5x", "letter after candidate"],
    ["xRUT: 12.345.678-5", "letter before label"],
    ["RUT: 12.345.678-5_", "underscore after candidate"],
    ["_RUT: 12.345.678-5", "underscore before label"],
    ["RUT:\n12.345.678-5", "newline between label and candidate"],
    ["12.345.678-5(RUT)", "0 spaces before paren"],
    ["myRUT: 12.345.678-5", "label not whole — my prefix"],
    ["RUTx: 12.345.678-5", "label not whole — x suffix"],
  ])("does not detect %s (%s)", (input) => {
    expect(detect(input)).toHaveLength(0);
  });

  test("detects multiple RUTs in text", () => {
    const results = detect("RUT: 12.345.678-5 and RUT: 1.234.567-4");
    expect(results).toHaveLength(2);
  });

  test("trailing period is not included in match", () => {
    const results = detect("RUT: 12.345.678-5.");
    expect(results).toHaveLength(1);
    expect(results[0]?.end).toBe(17);
  });

  test("id and replacement are correct", () => {
    expect(clRutDetector.id).toBe("cl_rut");
    expect(clRutDetector.replacement).toBe("[CL_RUT]");
  });

  test("stream metadata is correct", () => {
    expect(clRutDetector.stream).toEqual({
      maxMatchLength: 12,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
