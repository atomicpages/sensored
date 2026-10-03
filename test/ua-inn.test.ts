import { describe, expect, test } from "bun:test";
import { uaInnDetector } from "../src/detectors/national-id/ua-inn";

describe("UA INN detector", () => {
  test.each([
    "INN: 1234567890",
    "Ukrainian INN: 9876543210",
    "Tax: 1234567890",
    "Податковий: 1234567890",
    "ІНН: 1234567890",
    "INN:1234567890",
    "INN# 1234567890",
    "INN#1234567890",
    "inn: 1234567890",
    "INN:\t1234567890",
    "1234567890 (INN)",
    "1234567890 INN",
    "1234567890\t(INN)",
    "INN: 1234567890.",
    "(INN: 1234567890)",
  ])("positive: %s", (input) => {
    const detections = uaInnDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "ua_inn",
      entityType: "ua_inn",
      reasons: ["ua_inn.format", "ua_inn.context"],
    });
    expect(input.slice(detections[0]?.start, detections[0]?.end)).toMatch(
      /\d{10}/,
    );
  });

  test.each([
    ["Reference: 1234567890", "non-approved label"],
    ["1234567890", "no context"],
    ["myINN: 1234567890", "label not whole — my prefix"],
    ["INNx: 1234567890", "label not whole — x suffix"],
    ["INN:\n1234567890", "newline between label and candidate"],
    ["INN:         1234567890", "9 spaces exceeds 0-8"],
    ["1234567890(INN)", "0 spaces before paren — following requires 1-8"],
    ["1234567890 (INN", "missing closing paren"],
    ["1234567890x (INN)", "letter after candidate before following label"],
    ["INN: 12345678901", "digit after candidate"],
    ["INN: 01234567890", "digit before candidate"],
    ["INN: 1234567890_", "underscore after candidate"],
    ["_INN: 1234567890", "underscore before label"],
    ["INN: 1234567890\u0301", "combining mark after candidate"],
    ["INN: 123456789", "9 digits"],
    ["INN: 12345678901", "11 digits"],
  ])("negative: %s (%s)", (input) => {
    const detections = uaInnDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "INN: 1234567890 and INN: 9876543210";
    const detections = uaInnDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]?.start, detections[0]?.end)).toBe(
      "1234567890",
    );
    expect(text.slice(detections[1]?.start, detections[1]?.end)).toBe(
      "9876543210",
    );
  });

  test("detector metadata", () => {
    expect(uaInnDetector.id).toBe("ua_inn");
    expect(uaInnDetector.entityType).toBe("ua_inn");
    expect(uaInnDetector.replacement).toBe("[UA_INN]");
    expect(uaInnDetector.stream).toEqual({
      maxMatchLength: 10,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
