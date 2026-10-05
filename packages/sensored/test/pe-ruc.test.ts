import { describe, expect, test } from "bun:test";
import { peRucDetector } from "../src/detectors/national-id/pe-ruc";

function detect(text: string) {
  return peRucDetector.detect(text);
}

describe("Peru RUC detector", () => {
  test.each([
    ["RUC: 20123456789", 5, 16],
    ["Peru RUC: 20123456789", 10, 21],
    ["Perú RUC: 20123456789", 10, 21],
    ["Tax: 20123456789", 5, 16],
    ["SUNAT: 20123456789", 7, 18],
    ["Tributario: 20123456789", 12, 23],
    ["RUC: 10123456789", 5, 16],
    ["RUC: 15123456789", 5, 16],
    ["RUC: 17123456789", 5, 16],
    ["RUC: 20123456789 here", 5, 16],
    ["20123456789 (RUC)", 0, 11],
    ["20123456789 RUC", 0, 11],
    ["ruc: 20123456789", 5, 16],
    ["RUC:        20123456789", 12, 23],
  ])("detects %s", (input, start, end) => {
    const results = detect(input);
    expect(results).toHaveLength(1);
    expect(results[0]?.start).toBe(start);
    expect(results[0]?.end).toBe(end);
    expect(results[0]?.ruleId).toBe("pe_ruc");
    expect(results[0]?.entityType).toBe("pe_ruc");
    expect(results[0]?.reasons).toEqual(["pe_ruc.format", "pe_ruc.context"]);
  });

  test.each([
    ["20123456789", "no context"],
    ["Reference: 20123456789", "wrong context"],
    ["RUC: 12345678901", "invalid prefix 12"],
    ["RUC: 30123456789", "invalid prefix 30"],
    ["RUC: 05123456789", "invalid prefix 05"],
    ["RUC: 1234567890", "10 digits too short"],
    ["RUC: 201234567890", "12 digits too long"],
    ["RUC: 20123456789x", "letter after candidate"],
    ["xRUC: 20123456789", "letter before label"],
    ["RUC: 20123456789_", "underscore after candidate"],
    ["_RUC: 20123456789", "underscore before label"],
    ["RUC:\n20123456789", "newline between label and candidate"],
    ["20123456789(RUC)", "0 spaces before paren"],
    ["myRUC: 20123456789", "label not whole — my prefix"],
    ["RUCx: 20123456789", "label not whole — x suffix"],
  ])("does not detect %s (%s)", (input) => {
    expect(detect(input)).toHaveLength(0);
  });

  test("detects multiple RUCs in text", () => {
    const results = detect("RUC: 20123456789 and RUC: 10123456789");
    expect(results).toHaveLength(2);
  });

  test("trailing period is not included in match", () => {
    const results = detect("RUC: 20123456789.");
    expect(results).toHaveLength(1);
    expect(results[0]?.end).toBe(16);
  });

  test("id and replacement are correct", () => {
    expect(peRucDetector.id).toBe("pe_ruc");
    expect(peRucDetector.replacement).toBe("[PE_RUC]");
  });

  test("stream metadata is correct", () => {
    expect(peRucDetector.stream).toEqual({
      maxMatchLength: 11,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
