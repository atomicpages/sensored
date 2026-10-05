import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";
import { legalCaseDetector } from "../src/detectors/legal/legal-case";

const redactor = createRedactor({
  rules: { legal_case: { action: "redact" } },
});

describe("Legal case complete-string processing", () => {
  test.each([
    ["Case No: CV20210012345", "Case No: [LEGAL_CASE]"],
    ["Docket No: ABC12345678", "Docket No: [LEGAL_CASE]"],
    ["Court Case: 12-34567AB890123", "Court Case: [LEGAL_CASE]"],
    ["Subpoena No: ABC123456", "Subpoena No: [LEGAL_CASE]"],
    ["Summons No: 1234567890", "Summons No: [LEGAL_CASE]"],
    ["Judgment No: ABC123456789", "Judgment No: [LEGAL_CASE]"],
    ["Order No: ABC123456789", "Order No: [LEGAL_CASE]"],
    ["Decree No: ABC123456789", "Decree No: [LEGAL_CASE]"],
    ["Bankruptcy No: 12-34567", "Bankruptcy No: [LEGAL_CASE]"],
    ["BK No: 12-34567", "BK No: [LEGAL_CASE]"],
    ["Probate No: A12345678", "Probate No: [LEGAL_CASE]"],
    ["Estate No: B1234567890", "Estate No: [LEGAL_CASE]"],
    ["Legal Case: CV20210012345", "Legal Case: [LEGAL_CASE]"],
    ["Lawsuit Docket: ABC123456789", "Lawsuit Docket: [LEGAL_CASE]"],
    ["CASE# ABC12345678", "CASE# [LEGAL_CASE]"],
    ["Case No: CV-2021-00123456", "Case No: [LEGAL_CASE]"],
    ["Subpoena No: ABC123456789012", "Subpoena No: [LEGAL_CASE]"],
    ["Judgment No: ABC123456", "Judgment No: [LEGAL_CASE]"],
    ["Case: CV20210012345", "Case: [LEGAL_CASE]"],
    ["case no: cv20210012345", "case no: [LEGAL_CASE]"],
    ["CV20210012345 (Case)", "[LEGAL_CASE] (Case)"],
    ["ABC12345678 (Docket)", "[LEGAL_CASE] (Docket)"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: ABC12345678", "non-approved label"],
    ["ABC12345678", "no label"],
    ["myCase: ABC12345678", "label not whole — my prefix"],
    ["Casex: ABC12345678", "label not whole — x suffix"],
    ["Case:\nABC12345678", "newline between label and candidate"],
    ["Case:         ABC12345678", "9 spaces exceeds 0-8"],
    ["Case No: ABCDEFGHIJ", "no digit in candidate"],
    ["ABC12345678 (Reference)", "non-approved following label"],
    ["ABC12345678(Case)", "0 spaces before paren — following requires 1-8"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("minimum length candidate (6 chars) is redacted", () => {
    expect(redactor.redact("Case No: A12345")).toBe("Case No: [LEGAL_CASE]");
  });

  test("below minimum length candidate (5 chars) is not redacted", () => {
    expect(redactor.redact("Case No: A1234")).toBe("Case No: A1234");
  });

  test("maximum length candidate (16 chars) is redacted", () => {
    expect(redactor.redact("Case No: 12-34567AB890123")).toBe(
      "Case No: [LEGAL_CASE]",
    );
  });

  test("above maximum length candidate (17 chars) is not redacted", () => {
    expect(redactor.redact("Case No: ABC12345678901234")).toBe(
      "Case No: ABC12345678901234",
    );
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Case No: CV20210012345");
    expect(result.text).toBe("Case No: [LEGAL_CASE]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      ruleId: "legal_case",
      entityType: "legal_case",
      reasons: ["legal_case.format", "legal_case.context"],
    });
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        legal_case: { action: "mask", preserve: { last: 4 } },
      },
    });
    const result = masker.redact("Case No: CV20210012345");
    expect(result).toContain("2345");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { legal_case: { action: "remove" } },
    });
    expect(remover.redact("Case No: CV20210012345")).toBe("Case No: ");
  });

  test("detector class detect() produces correct detections", () => {
    const detections = legalCaseDetector.detect("Case No: CV20210012345");
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "legal_case",
      entityType: "legal_case",
      reasons: ["legal_case.format", "legal_case.context"],
    });
  });

  test("detector class rejects non-contextual matches", () => {
    const detections = legalCaseDetector.detect("ABC12345678");
    expect(detections).toHaveLength(0);
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { legal_case: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.legal_case)).toBe(true);
  });

  test("legal_case off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { legal_case: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown legal_case rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { legal_case: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
