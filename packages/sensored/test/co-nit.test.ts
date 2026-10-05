import { describe, expect, test } from "bun:test";
import { coNitDetector } from "../src/detectors/national-id/co-nit";

function detect(text: string) {
  return coNitDetector.detect(text);
}

describe("Colombia NIT detector", () => {
  test.each([
    ["NIT: 123456789-0", 5, 16],
    ["Colombia NIT: 123456789-0", 14, 25],
    ["Tax: 123456789-0", 5, 16],
    ["Impuesto: 123456789-0", 10, 21],
    ["Tributario: 123456789-0", 12, 23],
    ["Empresa: 123456789-0", 9, 20],
    ["NIT: 123456789-0 here", 5, 16],
    ["123456789-0 (NIT)", 0, 11],
    ["123456789-0 NIT", 0, 11],
    ["nit: 123456789-0", 5, 16],
    ["NIT:        123456789-0", 12, 23],
  ])("detects %s", (input, start, end) => {
    const results = detect(input);
    expect(results).toHaveLength(1);
    expect(results[0]?.start).toBe(start);
    expect(results[0]?.end).toBe(end);
    expect(results[0]?.ruleId).toBe("co_nit");
    expect(results[0]?.entityType).toBe("co_nit");
    expect(results[0]?.reasons).toEqual(["co_nit.format", "co_nit.context"]);
  });

  test.each([
    ["123456789-0", "no context"],
    ["Reference: 123456789-0", "wrong context"],
    ["NIT: 123456789", "missing check digit"],
    ["NIT: 12345678-0", "too few body digits"],
    ["NIT: 1234567890-0", "too many body digits"],
    ["NIT: 123456789-0x", "letter after candidate"],
    ["xNIT: 123456789-0", "letter before label"],
    ["NIT: 123456789-0_", "underscore after candidate"],
    ["_NIT: 123456789-0", "underscore before label"],
    ["NIT:\n123456789-0", "newline between label and candidate"],
    ["123456789-0(NIT)", "0 spaces before paren"],
    ["myNIT: 123456789-0", "label not whole — my prefix"],
    ["NITx: 123456789-0", "label not whole — x suffix"],
  ])("does not detect %s (%s)", (input) => {
    expect(detect(input)).toHaveLength(0);
  });

  test("detects multiple NITs in text", () => {
    const results = detect("NIT: 123456789-0 and NIT: 987654321-5");
    expect(results).toHaveLength(2);
  });

  test("trailing period is not included in match", () => {
    const results = detect("NIT: 123456789-0.");
    expect(results).toHaveLength(1);
    expect(results[0]?.end).toBe(16);
  });

  test("id and replacement are correct", () => {
    expect(coNitDetector.id).toBe("co_nit");
    expect(coNitDetector.replacement).toBe("[CO_NIT]");
  });

  test("stream metadata is correct", () => {
    expect(coNitDetector.stream).toEqual({
      maxMatchLength: 11,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
