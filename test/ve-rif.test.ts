import { describe, expect, test } from "bun:test";
import { veRifDetector } from "../src/detectors/national-id/ve-rif";

function detect(text: string) {
  return veRifDetector.detect(text);
}

describe("Venezuela RIF detector", () => {
  test.each([
    ["RIF: V-12345678-0", 5, 17],
    ["RIF: E-12345678-0", 5, 17],
    ["RIF: J-12345678-0", 5, 17],
    ["RIF: G-12345678-0", 5, 17],
    ["Venezuela RIF: V-12345678-0", 15, 27],
    ["Tax: V-12345678-0", 5, 17],
    ["SENIAT: V-12345678-0", 8, 20],
    ["Tributario: V-12345678-0", 12, 24],
    ["RIF: V-12345678-0 here", 5, 17],
    ["V-12345678-0 (RIF)", 0, 12],
    ["V-12345678-0 RIF", 0, 12],
    ["rif: v-12345678-0", 5, 17],
    ["RIF:        V-12345678-0", 12, 24],
  ])("detects %s", (input, start, end) => {
    const results = detect(input);
    expect(results).toHaveLength(1);
    expect(results[0]?.start).toBe(start);
    expect(results[0]?.end).toBe(end);
    expect(results[0]?.ruleId).toBe("ve_rif");
    expect(results[0]?.entityType).toBe("ve_rif");
    expect(results[0]?.reasons).toEqual(["ve_rif.format", "ve_rif.context"]);
  });

  test.each([
    ["V-12345678-0", "no context"],
    ["Reference: V-12345678-0", "wrong context"],
    ["RIF: X-12345678-0", "invalid prefix X"],
    ["RIF: V12345678-0", "missing first hyphen"],
    ["RIF: V-12345678", "missing check digit"],
    ["RIF: V-1234567-0", "too few body digits"],
    ["RIF: V-12345678-0x", "letter after candidate"],
    ["xRIF: V-12345678-0", "letter before label"],
    ["RIF: V-12345678-0_", "underscore after candidate"],
    ["_RIF: V-12345678-0", "underscore before label"],
    ["RIF:\nV-12345678-0", "newline between label and candidate"],
    ["V-12345678-0(RIF)", "0 spaces before paren"],
    ["myRIF: V-12345678-0", "label not whole — my prefix"],
    ["RIFx: V-12345678-0", "label not whole — x suffix"],
  ])("does not detect %s (%s)", (input) => {
    expect(detect(input)).toHaveLength(0);
  });

  test("detects multiple RIFs in text", () => {
    const results = detect("RIF: V-12345678-0 and RIF: J-87654321-5");
    expect(results).toHaveLength(2);
  });

  test("trailing period is not included in match", () => {
    const results = detect("RIF: V-12345678-0.");
    expect(results).toHaveLength(1);
    expect(results[0]?.end).toBe(17);
  });

  test("id and replacement are correct", () => {
    expect(veRifDetector.id).toBe("ve_rif");
    expect(veRifDetector.replacement).toBe("[VE_RIF]");
  });

  test("stream metadata is correct", () => {
    expect(veRifDetector.stream).toEqual({
      maxMatchLength: 13,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
