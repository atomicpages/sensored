import { describe, expect, test } from "bun:test";
import { roCnpDetector } from "../src/detectors/national-id/ro-cnp";

describe("RO CNP detector", () => {
  test.each([
    "Romania CNP: 1901011234567",
    "Romanian CNP: 2850515123456",
    "CNP: 1801211789012",
    "Cod Numeric: 1901011234567",
    "Personal: 2850515123456",
    "CNP:1901011234567",
    "CNP# 1901011234567",
    "CNP#1901011234567",
    "cnp: 1901011234567",
    "CNP:\t1901011234567",
    "1901011234567 (CNP)",
    "1901011234567 CNP",
    "1901011234567\t(CNP)",
    "CNP: 1901011234567.",
    "(CNP: 1901011234567)",
    "CNP: 1800512345678",
    "CNP: 2911231789012",
  ])("positive: %s", (input) => {
    const detections = roCnpDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "ro_cnp",
      entityType: "ro_cnp",
      reasons: ["ro_cnp.structure", "ro_cnp.context"],
    });
    expect(input.slice(detections[0]?.start, detections[0]?.end)).toMatch(
      /\d{13}/,
    );
  });

  test.each([
    ["Reference: 1901011234567", "non-approved label"],
    ["1901011234567", "no context"],
    ["myCNP: 1901011234567", "label not whole — my prefix"],
    ["CNPx: 1901011234567", "label not whole — x suffix"],
    ["CNP:\n1901011234567", "newline between label and candidate"],
    ["CNP:         1901011234567", "9 spaces exceeds 0-8"],
    ["1901011234567(CNP)", "0 spaces before paren — following requires 1-8"],
    ["1901011234567 (CNP", "missing closing paren"],
    ["1901011234567x (CNP)", "letter after candidate before following label"],
    ["CNP: 19010112345678", "digit after candidate"],
    ["CNP: 01901011234567", "digit before candidate"],
    ["CNP: 1901011234567_", "underscore after candidate"],
    ["_CNP: 1901011234567", "underscore before label"],
    ["CNP: 1901011234567\u0301", "combining mark after candidate"],
    ["CNP: 0900101234567", "first digit 0 invalid"],
    ["CNP: 1900001234567", "month 00 invalid"],
    ["CNP: 1901301234567", "month 13 invalid"],
    ["CNP: 1900100234567", "day 00 invalid"],
    ["CNP: 1900132234567", "day 32 invalid"],
    ["CNP: 190101123456", "12 digits"],
    ["CNP: 19010112345678", "14 digits"],
  ])("negative: %s (%s)", (input) => {
    const detections = roCnpDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "CNP: 1901011234567 and CNP: 2850515123456";
    const detections = roCnpDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]?.start, detections[0]?.end)).toBe(
      "1901011234567",
    );
    expect(text.slice(detections[1]?.start, detections[1]?.end)).toBe(
      "2850515123456",
    );
  });

  test("detector metadata", () => {
    expect(roCnpDetector.id).toBe("ro_cnp");
    expect(roCnpDetector.entityType).toBe("ro_cnp");
    expect(roCnpDetector.replacement).toBe("[RO_CNP]");
    expect(roCnpDetector.stream).toEqual({
      maxMatchLength: 13,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
