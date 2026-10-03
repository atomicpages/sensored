import { describe, expect, test } from "bun:test";
import { rsJmbgDetector } from "../src/detectors/national-id/rs-jmbg";

describe("RS JMBG detector", () => {
  test.each([
    "Serbia JMBG: 0101990123456",
    "Serbian JMBG: 1505900123456",
    "JMBG: 0101990123456",
    "Jedinstveni: 0101990123456",
    "Matični: 0101990123456",
    "Personal: 0101990123456",
    "JMBG:0101990123456",
    "JMBG# 0101990123456",
    "JMBG#0101990123456",
    "jmbg: 0101990123456",
    "JMBG:\t0101990123456",
    "0101990123456 (JMBG)",
    "0101990123456 JMBG",
    "0101990123456\t(JMBG)",
    "JMBG: 0101990123456.",
    "(JMBG: 0101990123456)",
    "JMBG: 3101990123456",
    "JMBG: 0112990123456",
  ])("positive: %s", (input) => {
    const detections = rsJmbgDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "rs_jmbg",
      entityType: "rs_jmbg",
      reasons: ["rs_jmbg.structure", "rs_jmbg.context"],
    });
    expect(input.slice(detections[0]?.start, detections[0]?.end)).toMatch(
      /\d{13}/,
    );
  });

  test.each([
    ["Reference: 0101990123456", "non-approved label"],
    ["0101990123456", "no context"],
    ["myJMBG: 0101990123456", "label not whole — my prefix"],
    ["JMBGx: 0101990123456", "label not whole — x suffix"],
    ["JMBG:\n0101990123456", "newline between label and candidate"],
    ["JMBG:         0101990123456", "9 spaces exceeds 0-8"],
    ["0101990123456(JMBG)", "0 spaces before paren — following requires 1-8"],
    ["0101990123456 (JMBG", "missing closing paren"],
    ["0101990123456x (JMBG)", "letter after candidate before following label"],
    ["JMBG: 01019901234567", "digit after candidate"],
    ["JMBG: 00101990123456", "digit before candidate"],
    ["JMBG: 0101990123456_", "underscore after candidate"],
    ["_JMBG: 0101990123456", "underscore before label"],
    ["JMBG: 0101990123456\u0301", "combining mark after candidate"],
    ["JMBG: 0099901234567", "day 00 invalid"],
    ["JMBG: 3299901234567", "day 32 invalid"],
    ["JMBG: 0100990123456", "month 00 invalid"],
    ["JMBG: 0113990123456", "month 13 invalid"],
    ["JMBG: 010199012345", "12 digits"],
    ["JMBG: 01019901234567", "14 digits"],
  ])("negative: %s (%s)", (input) => {
    const detections = rsJmbgDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "JMBG: 0101990123456 and JMBG: 1505900123456";
    const detections = rsJmbgDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]?.start, detections[0]?.end)).toBe(
      "0101990123456",
    );
    expect(text.slice(detections[1]?.start, detections[1]?.end)).toBe(
      "1505900123456",
    );
  });

  test("detector metadata", () => {
    expect(rsJmbgDetector.id).toBe("rs_jmbg");
    expect(rsJmbgDetector.entityType).toBe("rs_jmbg");
    expect(rsJmbgDetector.replacement).toBe("[RS_JMBG]");
    expect(rsJmbgDetector.stream).toEqual({
      maxMatchLength: 13,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
