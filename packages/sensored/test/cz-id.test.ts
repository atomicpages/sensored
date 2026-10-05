import { describe, expect, test } from "bun:test";
import { czIdDetector } from "../src/detectors/national-id/cz-id";

describe("Czech Rodné číslo detector", () => {
  test.each([
    "Czech National ID: 900101/1234",
    "Czechia: 900101/1234",
    "Republic: 900101/1234",
    "Rodné číslo: 900101/1234",
    "Číslo: 900101/1234",
    "National ID: 900101/1234",
    "Czech:900101/1234",
    "Czech# 900101/1234",
    "Czech#900101/1234",
    "czech: 900101/1234",
    "CZECH: 900101/1234",
    "Czech:\t900101/1234",
    "900101/1234 (Czech)",
    "900101/1234 Czech",
    "900101/1234\t(Czech)",
    "Czech: 900101/1234.",
    "(Czech: 900101/1234)",
    "Czech: 905101/1234",
    "Czech: 900131/1234",
  ])("positive: %s", (input) => {
    const detections = czIdDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "cz_id",
      entityType: "cz_id",
      reasons: ["cz_id.structure", "cz_id.context"],
    });
    expect(input.slice(detections[0]?.start, detections[0]?.end)).toMatch(
      /\d{6}\/\d{4}/,
    );
  });

  test.each([
    ["Reference: 900101/1234", "non-approved label"],
    ["900101/1234", "no context"],
    ["myCzech: 900101/1234", "label not whole — my prefix"],
    ["Czechx: 900101/1234", "label not whole — x suffix"],
    ["Czech:\n900101/1234", "newline between label and candidate"],
    ["Czech:         900101/1234", "9 spaces exceeds 0-8"],
    ["900101/1234(Czech)", "0 spaces before paren — following requires 1-8"],
    ["900101/1234 (Czech", "missing closing paren"],
    ["900101/1234x (Czech)", "letter after candidate before following label"],
    ["Czech: 900101/12345", "digit after candidate"],
    ["Czech: 0900101/1234", "digit before candidate"],
    ["Czech: 900101/1234_", "underscore after candidate"],
    ["_Czech: 900101/1234", "underscore before label"],
    ["Czech: 900101/1234\u0301", "combining mark after candidate"],
    ["Czech: 900001/1234", "month 00 invalid"],
    ["Czech: 901301/1234", "month 13 invalid"],
    ["Czech: 906301/1234", "month 63 invalid (above 62)"],
    ["Czech: 900100/1234", "day 00 invalid"],
    ["Czech: 900132/1234", "day 32 invalid"],
    ["Czech: 9001011234", "missing slash"],
    ["Czech: 90010/1234", "wrong digit count before slash"],
    ["Czech: 900101/123", "wrong digit count after slash"],
  ])("negative: %s (%s)", (input) => {
    const detections = czIdDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Czech: 900101/1234 and Czech: 905101/5678";
    const detections = czIdDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]?.start, detections[0]?.end)).toBe(
      "900101/1234",
    );
    expect(text.slice(detections[1]?.start, detections[1]?.end)).toBe(
      "905101/5678",
    );
  });

  test("detector metadata", () => {
    expect(czIdDetector.id).toBe("cz_id");
    expect(czIdDetector.entityType).toBe("cz_id");
    expect(czIdDetector.replacement).toBe("[CZ_ID]");
    expect(czIdDetector.stream).toEqual({
      maxMatchLength: 11,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
